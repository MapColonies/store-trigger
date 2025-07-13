import express, { Router } from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import { OpenapiViewerRouter, OpenapiRouterConfig } from '@map-colonies/openapi-express-viewer';
import { getErrorHandlerMiddleware } from '@map-colonies/error-express-handler';
import { middleware as OpenApiMiddleware } from 'express-openapi-validator';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import httpLogger from '@map-colonies/express-access-log-middleware';
import { collectMetricsExpressMiddleware } from '@map-colonies/telemetry';
import { Registry } from 'prom-client';
import { SERVICES } from './common/constants';
import { IConfig } from './common/interfaces';
import { JOB_OPERATIONS_ROUTER_SYMBOL } from './jobOperations/routes/jobOperationsRouter';
import { JOB_STATUS_ROUTER_SYMBOL } from './jobStatus/routes/jobStatusRouter';
import { handleError } from './common/handleError';

@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JOB_OPERATIONS_ROUTER_SYMBOL) private readonly jobOperationsRouter: Router,
    @inject(JOB_STATUS_ROUTER_SYMBOL) private readonly jobStatusRouter: Router,
    @inject(SERVICES.METRICS_REGISTRY) private readonly metricsRegistry?: Registry
  ) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.buildRoutes();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private buildDocsRoutes(): void {
    const openapiRouter = new OpenapiViewerRouter({
      ...this.config.get<OpenapiRouterConfig>('openapiConfig'),
      filePathOrSpec: this.config.get<string>('openapiConfig.filePath'),
    });
    openapiRouter.setup();
    this.serverInstance.use(this.config.get<string>('openapiConfig.basePath'), openapiRouter.getRouter());
  }

  private buildRoutes(): void {
    this.serverInstance.use('/jobOperations', this.jobOperationsRouter);
    this.serverInstance.use('/jobStatus', this.jobStatusRouter);
    this.buildDocsRoutes();
  }

  private registerPreRoutesMiddleware(): void {
    if (this.metricsRegistry) {
      this.serverInstance.use(collectMetricsExpressMiddleware({ registry: this.metricsRegistry, collectNodeMetrics: true }));
    }

    this.serverInstance.use(httpLogger({ logger: this.logger, ignorePaths: ['/metrics'] }));

    if (this.config.get<boolean>('server.response.compression.enabled')) {
      this.serverInstance.use(compression(this.config.get<compression.CompressionFilter>('server.response.compression.options')));
    }

    this.serverInstance.use(bodyParser.json(this.config.get<bodyParser.Options>('server.request.payload')));

    const ignorePathRegex = new RegExp(`^${this.config.get<string>('openapiConfig.basePath')}/.*`, 'i');
    const apiSpecPath = this.config.get<string>('openapiConfig.filePath');
    this.serverInstance.use(OpenApiMiddleware({ apiSpec: apiSpecPath, validateRequests: true, ignorePaths: ignorePathRegex }));
  }

  private registerPostRoutesMiddleware(): void {
    this.serverInstance.use(getErrorHandlerMiddleware());
    this.serverInstance.use(handleError);
  }
}
