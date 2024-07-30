import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { FlowJob, FlowProducer, Job, Worker } from 'bullmq';
import client from 'prom-client';
import { Tracer } from '@opentelemetry/api';
import { JOB_TYPE, SERVICES } from '../common/constants';
import { IConfig, Provider, TaskParameters, Payload } from '../common/interfaces';
import { QueueFileHandler } from '../handlers/queueFileHandler';
import { PERCENTAGES, QUEUES, Stage } from '../common/commonBullMQ';

@injectable()
export class IngestionManager {
  //metrics
  private readonly jobsHistogram?: client.Histogram<'type'>;

  private worker: Worker<Payload> | null = null;
  private readonly taskType: string;
  private readonly batchSize: number;
  private readonly maxConcurrency!: number;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.FLOW_PRODUCER) private readonly flowProducer: FlowProducer,
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

    this.batchSize = config.get<number>('jobManager.task.batches');
    this.taskType = config.get<string>('jobManager.task.type');
    this.maxConcurrency = this.config.get<number>('maxConcurrency');
  }

  public start(): void {
    this.worker = new Worker(
      QUEUES.taskQueues.storeTriggerQueue,
      async (job) => {
        this.logger.debug({ msg: 'Starts writing content to queue file', modelId: job.data.modelId, modelName: job.data.metadata.productName });
        await this.queueFileHandler.createQueueFile(job.data.modelId);

        try {
          const createJobTimerEnd = this.jobsHistogram?.startTimer({ type: JOB_TYPE });
          const fileCount: number = await this.provider.streamModelPathsToQueueFile(
            job.data.modelId,
            job.data.pathToTileset,
            job.data.metadata.productName!
          );
          this.logger.debug({
            msg: 'Finished writing content to queue file. Creating Tasks',
            modelId: job.data.modelId,
            modelName: job.data.metadata.productName,
          });
          if (job.parent == undefined) {
            console.error({ msg: 'ERROR WITH PARENT', job: job.parent });
            throw new Error('ERROR WITH PARENT');
          }
          const tasks = this.createTasks(this.batchSize, job.data.modelId, job.parent.id, fileCount);
          this.logger.info({ msg: 'Tasks created successfully', modelId: job.data.modelId, modelName: job.data.metadata.productName });

          await this.createTasksForJob(tasks);
          this.logger.info({ msg: 'Job created successfully', modelId: job.data.modelId, modelName: job.data.metadata.productName });
          if (createJobTimerEnd) {
            createJobTimerEnd();
          }
          await this.queueFileHandler.deleteQueueFile(job.data.modelId);
          return PERCENTAGES.listPaths;
        } catch (error) {
          this.logger.error({ msg: 'Failed in creating tasks', modelId: job.data.modelId, modelName: job.data.metadata.productName, error });
          await this.queueFileHandler.deleteQueueFile(job.data.modelId);
          throw error;
        }
      },
      {
        connection: {
          host: '127.0.0.1',
          port: 6379,
        },
        prefix: '3D',
      }
    );

    //   this.worker.on('completed', (job) => {
    //     // await this.flowProducer.getFlow({
    //     //   id: job.parent!.id,
    //     //   queueName: QUEUES.jobsQueue
    //     // })
    //     // this.logger.info("Completed!!!!");
    //   })
  }

  public async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.pause();
      this.logger.info('Worker stopped successfully.');
    }
  }

  private async createTasksForJob(tasks: FlowJob[]): Promise<void> {
    await this.flowProducer.addBulk(tasks);
  }

  private createTasks(batchSize: number, modelId: string, parentId: string, fileCount: number): FlowJob[] {
    const numOfTasks = Math.ceil(fileCount / batchSize);
    const tasks: FlowJob[] = [];
    let chunk: string[] = [];
    let data: string | null = this.queueFileHandler.readline(modelId);

    while (data !== null) {
      if (this.isFileInBlackList(data)) {
        this.logger.warn({ msg: 'The file is is the black list! Ignored...', file: data, modelId });
      } else {
        chunk.push(data);

        if (chunk.length === batchSize) {
          const task = this.buildTaskFromChunk(chunk, modelId, parentId, numOfTasks);
          tasks.push(task);
          chunk = [];
        }
      }

      data = this.queueFileHandler.readline(modelId);
    }

    // Create task from the rest of the last chunk
    if (chunk.length > 0) {
      const task = this.buildTaskFromChunk(chunk, modelId, parentId, numOfTasks);
      tasks.push(task);
    }

    return tasks;
  }

  private buildTaskFromChunk(chunk: string[], modelId: string, parentId: string, numOfTasks: number): FlowJob {
    const parameters: TaskParameters = { paths: chunk, modelId, lastIndexError: -1, numOfTasks };
    return {
      queueName: QUEUES.taskQueues.fileSyncerQueue,
      name: this.taskType,
      data: parameters,
      opts: {
        parent: { id: parentId, queue: `3D:${QUEUES.jobsQueue}` },
        attempts: 3,
        backoff: { type: 'exponential' },
        removeOnComplete: { age: 50 },
      },
    };
  }

  private isFileInBlackList(data: string): boolean {
    const blackList = this.config.get<string[]>('ingestion.blackList');
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const fileExtension = data.split('.').slice(-1)[0];
    return blackList.includes(fileExtension);
  }
}
