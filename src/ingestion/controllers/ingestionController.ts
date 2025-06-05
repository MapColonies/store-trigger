import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { IJobResponse } from '@map-colonies/mc-priority-queue';
import { AppError } from '../../common/appError';
import { SERVICES } from '../../common/constants';
import { IngestionResponse, JobParameters, LogContext, Payload, TaskParameters } from '../../common/interfaces';
import { IngestionManager } from '../models/ingestionManager';

type CreateResourceHandler = RequestHandler<undefined, IngestionResponse, Payload>;

@injectable()
export class IngestionController {
  private readonly logContext: LogContext;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(IngestionManager) private readonly manager: IngestionManager) {
    this.logContext = {
      fileName: __filename,
      class: IngestionController.name,
    };
  }

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
        this.logger.error({
          msg: `Failed in ingesting a new model! Reason: ${err.message}`,
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
    const found = activeJobs.find((job: IJobResponse<JobParameters, TaskParameters>) => {
      if (job.parameters.metadata.productName === payload.metadata.productName) {
        return true;
      }
      return false;
    });
    return !found;
  }
}
