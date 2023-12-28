import { Logger } from '@map-colonies/js-logger';
import { BoundCounter, Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { AppError } from '../../common/appError';
import { SERVICES } from '../../common/constants';
import { JobsResponse, CreatePayload, DeletePayload } from '../../common/interfaces';
import { JobsManager } from '../models/jobsManager';

type CreateResourceHandler = RequestHandler<undefined, JobsResponse, CreatePayload>;
type DeleteResourceHandler = RequestHandler<undefined, JobsResponse, DeletePayload>;

@injectable()
export class JobsController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JobsManager) private readonly manager: JobsManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.createdResourceCounter = meter.createCounter('created_resource');
  }

  public create: CreateResourceHandler = async (req, res, next) => {
    const payload: CreatePayload = req.body;
    try {
      const jobCreated = await this.manager.createPostJob(payload);
      this.logger.debug({ msg: `Job created payload`, modelId: payload.modelId, payload, modelName: payload.metadata.productName });
      res.status(httpStatus.CREATED).json(jobCreated);
      await this.manager.createModel(payload, jobCreated.jobID);
      this.createdResourceCounter.add(1);
    } catch (error) {
      if (error instanceof AppError) {
        this.logger.error({
          msg: `Failed in ingesting a new model! Reason: ${error.message}`,
          modelId: payload.modelId,
          modelName: payload.metadata.productName,
        });
      }
      return next(error);
    }
  };

  public delete: DeleteResourceHandler = async (req, res, next) => {
    const payload: DeletePayload = req.body;
    try {
      const jobCreated = await this.manager.createDeleteJob(payload);
      this.logger.debug({ msg: `Job created payload`, modelId: payload.modelId, payload, modelLink: payload.modelLink });
      res.status(httpStatus.CREATED).json(jobCreated);
      await this.manager.deleteModel(payload, jobCreated.jobID);
      this.createdResourceCounter.add(1);
    } catch (error) {
      if (error instanceof AppError) {
        this.logger.error({
          msg: `Failed in deleting model! Reason: ${error.message}`,
          modelId: payload.modelId,
          modelLink: payload.modelLink,
        });
      }
      return next(error);
    }
  };
}
