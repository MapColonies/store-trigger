import config from 'config';
import { readPackageJsonSync } from '@map-colonies/read-pkg';

const packageJsonData = readPackageJsonSync();
export const SERVICE_NAME = packageJsonData.name ?? 'unknown_service';
export const SERVICE_VERSION = packageJsonData.version ?? 'unknown_version';
export const DEFAULT_SERVER_PORT = 80;

export const NODE_VERSION = process.versions.node;

export const INGESTION_JOB_TYPE = config.get<string>('jobManager.ingestion.jobType');
export const INGESTION_TASK_TYPE = config.get<string>('jobManager.ingestion.taskType');
export const DELETE_JOB_TYPE = config.get<string>('jobManager.delete.jobType');
export const DELETE_TASK_TYPE = config.get<string>('jobManager.delete.taskType');

export const DOMAIN = '3D';

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES: Record<string, symbol> = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  PROVIDER: Symbol('Provider'),
  PROVIDER_CONFIG: Symbol('ProviderConfig'),
  QUEUE_FILE_HANDLER: Symbol('QueueFileHandler'),
  JOB_MANAGER_CLIENT: Symbol('JobManagerClient'),
};
/* eslint-enable @typescript-eslint/naming-convention */
