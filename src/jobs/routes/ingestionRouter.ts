import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { JobsController } from '../controllers/ingestionController';

const ingestionRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(JobsController);

  router.post('/ingestion', controller.create);
  router.delete('/deleting', controller.delete);

  return router;
};

export const INGESTION_ROUTER_SYMBOL = Symbol('ingestionRouterFactory');

export { ingestionRouterFactory };
