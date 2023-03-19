import config from 'config';
import { logMethod } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { tracing } from './common/tracing';
import { ingestionRouterFactory, INGESTION_ROUTER_SYMBOL } from './ingestion/routes/ingestionRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { jobStatusRouterFactory, JOB_STATUS_ROUTER_SYMBOL } from './jobStatus/routes/jobStatusRouter';
import { IConfigProvider, IIngestionConfig, INFSConfig, IS3Config } from './common/interfaces';
import getProvider from './common/providers/getProvider';
import { QueueFileHandler } from './handlers/queueFileHandler';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  const fsConfig = config.get<INFSConfig>('NFS');
  const s3Config = config.get<IS3Config>('S3');
  const ingestionConfig = config.get<IIngestionConfig>('ingestion');
  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod } });

  const metrics = new Metrics(SERVICE_NAME);
  const meter = metrics.start();

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METER, provider: { useValue: meter } },
    { token: INGESTION_ROUTER_SYMBOL, provider: { useFactory: ingestionRouterFactory } },
    { token: JOB_STATUS_ROUTER_SYMBOL, provider: { useFactory: jobStatusRouterFactory } },
    { token: SERVICES.NFS, provider: { useValue: fsConfig } },
    { token: SERVICES.S3, provider: { useValue: s3Config } },
    { token: SERVICES.QUEUE_FILE_HANDLER, provider: { useClass: QueueFileHandler } },
    {
      token: SERVICES.CONFIG_PROVIDER,
      provider: {
        useFactory: (): IConfigProvider => {
          return getProvider(ingestionConfig.configProvider);
        },
      },
    },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop(), metrics.stop()]);
          },
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
