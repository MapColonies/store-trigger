import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { JobStatusResponse, JobStatusParams } from '../../common/interfaces';
import { JobStatusManager } from '../models/jobStatusManager';

type GetResourceHandler = RequestHandler<JobStatusParams, JobStatusResponse>;

@injectable()
export class JobStatusController {
  public constructor(@inject(JobStatusManager) private readonly manager: JobStatusManager) {}

  public checkStatus: GetResourceHandler = async (req, res, next) => {
    const { jobID } = req.params;
    try {
      const jobStatus = await this.manager.checkStatus(jobID);
      return res.status(httpStatus.OK).json(jobStatus);
    } catch (error) {
      next(error);
    }
  };
}
