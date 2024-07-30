import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { IConfig } from 'config';
import express, { Request, Response } from 'express';
import { collectMetricsExpressMiddleware } from '@map-colonies/telemetry';
import { Registry } from 'prom-client';
import { StatusCodes } from 'http-status-codes';
import { SERVICES } from './common/constants';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { IngestionManager } from './ingestion/ingestionManager';

@singleton()
export class App {
  private readonly intervalMs: number;
  private readonly port: number;
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.INGESTION_MANAGER) private readonly ingestionManager: IngestionManager,
    @inject(SERVICES.METRICS_REGISTRY) private readonly metricsRegistry?: Registry
  ) {
    this.intervalMs = 5000;
    this.port = this.config.get<number>('server.port');
    this.serverInstance = express();

    if (this.metricsRegistry) {
      this.serverInstance.use(collectMetricsExpressMiddleware({ registry: this.metricsRegistry, collectNodeMetrics: true }));
    }
    this.serverInstance.get('/liveness', (req: Request, res: Response) => {
      res.status(StatusCodes.OK).send('OK');
    });

    this.serverInstance.get('/stopWorker', (req: Request, res: Response) => {
      this.logger.info('Stopping Workers)');
    });
  }

  public run(): void {
    this.logger.info({ msg: 'Starting storeTrigger' });

    this.serverInstance.listen(this.port, () => {
      this.logger.info(`app started on port ${this.port}`);
    });

    this.ingestionManager.start();
  }
}

export function getApp(registerOptions?: RegisterOptions): App {
  const container = registerExternalValues(registerOptions);
  const app = container.resolve(App);
  return app;
}
