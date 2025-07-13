import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { JobOperationsController } from '../controllers/jobOperationsController';

const jobOperationsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(JobOperationsController);

  router.post('/ingestion', controller.create);
  router.post('/delete', controller.delete);

  return router;
};

export const JOB_OPERATIONS_ROUTER_SYMBOL = Symbol('jobOperationsRouterFactory');

export { jobOperationsRouterFactory };
