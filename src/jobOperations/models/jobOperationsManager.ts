import { Logger } from '@map-colonies/js-logger';
import { ICreateTaskBody, IFindJobsByCriteriaBody, IJobResponse, JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { inject, injectable } from 'tsyringe';
import client from 'prom-client';
import { withSpanAsyncV4, withSpanV4 } from '@map-colonies/telemetry';
import { Tracer, trace } from '@opentelemetry/api';
import { INFRA_CONVENTIONS, THREE_D_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { DELETE_JOB_TYPE, DELETE_TASK_TYPE, DOMAIN, INGESTION_JOB_TYPE, INGESTION_TASK_TYPE, SERVICES } from '../../common/constants';
import {
  CreateIngestionJobBody,
  IConfig,
  JobOperationResponse,
  IngestionJobParameters,
  Provider,
  IngestionTaskParameters,
  Payload,
  LogContext,
  CreatDeleteJobBody,
  DeleteTaskParameters,
  DeleteJobParameters,
  DeletePayload,
} from '../../common/interfaces';
import { QueueFileHandler } from '../../handlers/queueFileHandler';

@injectable()
export class JobOperationsManager {
  //metrics
  private readonly jobsHistogram?: client.Histogram<'type'>;

  private readonly providerName: string;
  private readonly batchSize: number;
  private readonly maxConcurrency!: number;
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.JOB_MANAGER_CLIENT) private readonly jobManagerClient: JobManagerClient,
    @inject(SERVICES.PROVIDER) private readonly provider: Provider,
    @inject(SERVICES.QUEUE_FILE_HANDLER) protected readonly queueFileHandler: QueueFileHandler,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    if (registry !== undefined) {
      this.jobsHistogram = new client.Histogram({
        name: 'jobs_duration_seconds',
        help: 'jobs duration time (seconds)',
        buckets: config.get<number[]>('telemetry.metrics.buckets'),
        labelNames: ['type'] as const,
        registers: [registry],
      });
    }

    this.providerName = this.config.get<string>('ingestion.provider');
    this.batchSize = config.get<number>('jobManager.ingestion.batches');
    this.maxConcurrency = this.config.get<number>('maxConcurrency');

    this.logContext = {
      fileName: __filename,
      class: JobOperationsManager.name,
    };
  }

  @withSpanAsyncV4
  public async getActiveIngestionJobs(): Promise<IJobResponse<IngestionJobParameters, IngestionTaskParameters>[]> {
    const findJobspayload: IFindJobsByCriteriaBody = {
      types: [INGESTION_JOB_TYPE],
      statuses: [OperationStatus.PENDING, OperationStatus.IN_PROGRESS],
      domain: DOMAIN,
      shouldReturnTasks: false,
      shouldReturnAvailableActions: false,
    };
    const jobsResponse = await this.jobManagerClient.findJobs<IngestionJobParameters, IngestionTaskParameters>(findJobspayload);
    return jobsResponse;
  }

  @withSpanAsyncV4
  public async createJob(payload: Payload): Promise<JobOperationResponse> {
    const job: CreateIngestionJobBody = {
      resourceId: payload.modelId,
      version: '1',
      type: INGESTION_JOB_TYPE,
      parameters: {
        metadata: payload.metadata,
        modelId: payload.modelId,
        tilesetFilename: payload.tilesetFilename,
        filesCount: 0,
        pathToTileset: payload.pathToTileset,
      },
      productType: payload.metadata.productType,
      productName: payload.metadata.productName,
      percentage: 0,
      producerName: payload.metadata.producerName,
      status: OperationStatus.PENDING,
      domain: DOMAIN,
    };

    const jobResponse = await this.jobManagerClient.createJob<IngestionJobParameters, IngestionTaskParameters>(job);

    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: jobResponse.id,
      [INFRA_CONVENTIONS.infra.jobManagement.jobType]: INGESTION_JOB_TYPE,
      [THREE_D_CONVENTIONS.three_d.catalogManager.catalogId]: payload.modelId,
    });

    const res: JobOperationResponse = {
      jobId: jobResponse.id,
      status: OperationStatus.PENDING,
    };

    return res;
  }

  @withSpanAsyncV4
  public async validateDeleteJob(modelId: string): Promise<boolean> {
    const activeDeleteJobs = await this.jobManagerClient.findJobs({
      domain: DOMAIN,
      types: [DELETE_JOB_TYPE],
      internalId: modelId,
      shouldReturnAvailableActions: false,
      shouldReturnTasks: false,
    });

    if (!Array.isArray(activeDeleteJobs) || activeDeleteJobs.length > 0) {
      return false;
    }
    return true;
  }

  @withSpanAsyncV4
  public async createDeleteJob(payload: DeletePayload): Promise<JobOperationResponse> {
    const logContext = { ...this.logContext, function: this.createDeleteJob.name };
    this.logger.info({
      msg: `Creating delete job for model ${payload.modelId}`,
      logContext,
      modelId: payload.modelId,
    });

    const job: CreatDeleteJobBody = {
      internalId: payload.modelId,
      resourceId: payload.productId,
      domain: DOMAIN,
      percentage: 0,
      version: payload.productVersion.toString(),
      productName: payload.productName,
      productType: payload.productType,
      producerName: payload.producerName,
      type: DELETE_JOB_TYPE,
      parameters: {
        modelId: payload.modelId,
      },
      tasks: [
        {
          type: DELETE_TASK_TYPE,
          parameters: { modelId: payload.modelId, blockDuplication: true },
        },
      ],
      status: OperationStatus.IN_PROGRESS,
    };

    let res: JobOperationResponse | undefined = undefined;
    try {
      const jobResponse = await this.jobManagerClient.createJob<DeleteJobParameters, DeleteTaskParameters>(job);
      res = {
        jobId: jobResponse.id,
        status: OperationStatus.IN_PROGRESS,
      };
    } catch (err) {
      this.logger.error({
        msg: `Failed in creating delete job for ${payload.modelId}`,
        logContext,
        modelId: payload.modelId,
        err,
      });
      throw err;
    }
    this.logger.info({
      msg: `Delete job created for ${payload.modelId}`,
      logContext,
      modelId: payload.modelId,
    });
    return res;
  }

  @withSpanAsyncV4
  public async createModel(payload: Payload, jobId: string): Promise<void> {
    const logContext = { ...this.logContext, function: this.createModel.name };
    this.logger.info({
      msg: 'Creating job for model',
      logContext,
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      provider: this.providerName,
    });

    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [INFRA_CONVENTIONS.infra.jobManagement.jobId]: jobId,
      [INFRA_CONVENTIONS.infra.jobManagement.jobType]: INGESTION_JOB_TYPE,
      [THREE_D_CONVENTIONS.three_d.catalogManager.catalogId]: payload.modelId,
    });

    this.logger.debug({
      msg: 'Starts writing content to queue file',
      logContext,
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
    });
    await this.queueFileHandler.createQueueFile(payload.modelId);

    try {
      const createJobTimerEnd = this.jobsHistogram?.startTimer({ type: INGESTION_JOB_TYPE });
      const fileCount: number = await this.provider.streamModelPathsToQueueFile(
        payload.modelId,
        payload.pathToTileset,
        payload.metadata.productName!
      );
      this.logger.debug({
        msg: 'Finished writing content to queue file. Creating Tasks',
        logContext,
        modelId: payload.modelId,
        modelName: payload.metadata.productName,
      });

      const tasks = this.createTasks(this.batchSize, payload.modelId);
      this.logger.info({
        msg: 'Tasks created successfully',
        logContext,
        modelId: payload.modelId,
        modelName: payload.metadata.productName,
      });

      await this.createTasksForJob(jobId, tasks, this.maxConcurrency);
      await this.updateFileCountAndStatusOfJob(jobId, fileCount);
      this.logger.info({
        msg: 'Job created successfully',
        logContext,
        modelId: payload.modelId,
        modelName: payload.metadata.productName,
      });
      if (createJobTimerEnd) {
        createJobTimerEnd();
      }
      await this.queueFileHandler.deleteQueueFile(payload.modelId);
    } catch (err) {
      this.logger.error({
        msg: 'Failed in creating tasks',
        logContext,
        modelId: payload.modelId,
        modelName: payload.metadata.productName,
        err,
      });
      await this.queueFileHandler.deleteQueueFile(payload.modelId);
      throw err;
    }
  }

  @withSpanAsyncV4
  private async createTasksForJob(jobId: string, tasks: ICreateTaskBody<IngestionTaskParameters>[], maxRequests: number): Promise<void> {
    const tempTasks = [...tasks];

    while (tempTasks.length) {
      const createTasksBatch = tempTasks.splice(0, maxRequests).map(async (task) => this.jobManagerClient.createTaskForJob(jobId, task));
      await Promise.all(createTasksBatch);
    }
  }

  @withSpanV4
  private createTasks(batchSize: number, modelId: string): ICreateTaskBody<IngestionTaskParameters>[] {
    const logContext = { ...this.logContext, function: this.createTasks.name };
    const tasks: ICreateTaskBody<IngestionTaskParameters>[] = [];
    let chunk: string[] = [];
    let data: string | null = this.queueFileHandler.readline(modelId);

    while (data !== null) {
      if (this.isFileInBlackList(data)) {
        this.logger.warn({
          msg: 'The file is is the black list! Ignored...',
          logContext,
          file: data,
          modelId,
        });
      } else {
        chunk.push(data);

        if (chunk.length === batchSize) {
          const task = this.buildTaskFromChunk(chunk, modelId);
          tasks.push(task);
          chunk = [];
        }
      }

      data = this.queueFileHandler.readline(modelId);
    }

    // Create task from the rest of the last chunk
    if (chunk.length > 0) {
      const task = this.buildTaskFromChunk(chunk, modelId);
      tasks.push(task);
    }

    return tasks;
  }

  @withSpanAsyncV4
  private async updateFileCountAndStatusOfJob(jobId: string, fileCount: number): Promise<void> {
    const job = await this.jobManagerClient.getJob<IngestionJobParameters, IngestionTaskParameters>(jobId, false);
    const parameters: IngestionJobParameters = { ...job.parameters, filesCount: fileCount };
    await this.jobManagerClient.updateJob(jobId, { status: OperationStatus.IN_PROGRESS, parameters });
  }

  private buildTaskFromChunk(chunk: string[], modelId: string): ICreateTaskBody<IngestionTaskParameters> {
    const parameters: IngestionTaskParameters = { paths: chunk, modelId, lastIndexError: -1 };
    return { type: INGESTION_TASK_TYPE, parameters };
  }

  private isFileInBlackList(data: string): boolean {
    const blackList = this.config.get<string[]>('ingestion.blackList');
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const fileExtension = data.split('.').slice(-1)[0];
    return blackList.includes(fileExtension);
  }
}
