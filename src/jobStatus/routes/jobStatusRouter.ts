import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { JobStatusController } from '../controllers/jobStatusController';

const jobStatusRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(JobStatusController);

  router.get('/:jobId', controller.checkStatus);

  return router;
};

export const JOB_STATUS_ROUTER_SYMBOL = Symbol('jobStatusRouterFactory');

export { jobStatusRouterFactory };
