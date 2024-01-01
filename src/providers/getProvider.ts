import config from 'config';
import httpStatus from 'http-status-codes';
import { AppError } from '../common/appError';
import { ProviderConfig, ProviderManager, ProvidersConfig } from '../common/interfaces';
import logger from '../common/logger';
import { QueueFileHandler } from '../handlers/queueFileHandler';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(config: ProviderConfig): S3Provider | NFSProvider {
  if (config.type === 'S3') {
    return new S3Provider(config, logger, new QueueFileHandler());
  } else {
    return new NFSProvider(config, logger, new QueueFileHandler());
  }
}

function getProviderManager(providerConfiguration: ProvidersConfig): ProviderManager {
  return {
    ingestion: getProvider(providerConfiguration.ingestion),
    delete: getProvider(providerConfiguration.delete),
  };
}

export { getProvider, getProviderManager };
