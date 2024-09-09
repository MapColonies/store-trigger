import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { AppError } from '../../common/appError';
import { SERVICES } from '../../common/constants';
import { IngestionResponse, LogContext, Payload } from '../../common/interfaces';
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
    } catch (error) {
      if (error instanceof AppError) {
        this.logger.error({
          msg: `Failed in ingesting a new model! Reason: ${error.message}`,
          logContext,
          modelId: payload.modelId,
          modelName: payload.metadata.productName,
        });
      }
      return next(error);
    }
  };
}
