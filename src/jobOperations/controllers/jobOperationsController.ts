import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { IJobResponse } from '@map-colonies/mc-priority-queue';
import { AppError } from '../../common/appError';
import { SERVICES } from '../../common/constants';
import { DeletePayload, JobOperationResponse, IngestionJobParameters, LogContext, Payload, IngestionTaskParameters } from '../../common/interfaces';
import { JobOperationsManager } from '../models/jobOperationsManager';

type CreateResourceHandler = RequestHandler<undefined, JobOperationResponse, Payload>;
type DeleteResourceHandler = RequestHandler<undefined, JobOperationResponse, DeletePayload>;

@injectable()
export class JobOperationsController {
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JobOperationsManager) private readonly manager: JobOperationsManager
  ) {
    this.logContext = {
      fileName: __filename,
      class: JobOperationsController.name,
    };
  }

  public delete: DeleteResourceHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.delete.name };
    const payload: DeletePayload = req.body;
    try {
      this.logger.info({
        msg: `Validate Delete Job Data`,
        logContext,
        modelId: payload.modelId,
      });
      const isValidJob = await this.manager.validateDeleteJob(payload.modelId);
      if (!isValidJob) {
        this.logger.warn({
          msg: `Delete Job Validation Failed`,
          logContext,
          modelId: payload.modelId,
        });
        throw new AppError(StatusCodes.BAD_REQUEST, 'Delete Job Validation Failed', true);
      }
      const jobCreated = await this.manager.createDeleteJob(payload);
      this.logger.info({
        msg: `Delete Job created payload`,
        logContext,
        modelId: payload.modelId,
      });
      res.status(httpStatus.CREATED).json(jobCreated);
    } catch (err) {
      if (err instanceof AppError) {
        const errorMessage = err as { message: string | undefined };
        const message = errorMessage.message ?? 'failed to create delete job';
        this.logger.error({
          msg: `Failed to create delete model, Reason: ${message}`,
          err,
          logContext,
          modelId: payload.modelId,
        });
      } else {
        this.logger.error({
          msg: `Failed to create delete model`,
          err,
          logContext,
          modelId: payload.modelId,
        });
      }
      return next(err);
    }
  };

  public create: CreateResourceHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.create.name };
    const payload: Payload = req.body;
    try {
      this.logger.debug({
        msg: `Validate Job Data`,
        logContext,
        modelId: payload.modelId,
        payload,
        modelName: payload.metadata.productName,
      });
      const isValidJob = await this.validateJobData(payload);
      if (!isValidJob) {
        this.logger.warn({
          msg: `Job Validation Failed`,
          logContext,
          modelId: payload.modelId,
          payload,
          modelName: payload.metadata.productName,
        });
        throw new AppError(StatusCodes.BAD_REQUEST, 'Job Validation Failed', true);
      }
      const jobCreated = await this.manager.createJob(payload);
      this.logger.debug({
        msg: `Job created payload`,
        logContext,
        modelId: payload.modelId,
        payload,
        modelName: payload.metadata.productName,
      });
      res.status(httpStatus.CREATED).json(jobCreated);
      await this.manager.createModel(payload, jobCreated.jobId);
    } catch (err) {
      if (err instanceof AppError) {
        const errorMessage = err as { message: string | undefined };
        const message = errorMessage.message ?? 'failed to create job';
        this.logger.error({
          msg: `Failed in ingesting a new model! Reason: ${message}`,
          err,
          logContext,
          modelId: payload.modelId,
          modelName: payload.metadata.productName,
        });
      }
      return next(err);
    }
  };

  private async validateJobData(payload: Payload): Promise<boolean> {
    const activeJobs = await this.manager.getActiveIngestionJobs();
    if (!Array.isArray(activeJobs)) {
      return false;
    }
    const found = activeJobs.find((job: IJobResponse<IngestionJobParameters, IngestionTaskParameters>) => {
      if (job.parameters.metadata.productName === payload.metadata.productName) {
        return true;
      }
      return false;
    });
    return !found;
  }
}
