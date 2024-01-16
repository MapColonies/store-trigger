import { container } from 'tsyringe';
import { ProviderConfig, ProviderManager, ProvidersConfig } from '../common/interfaces';
import { QueueFileHandler } from '../handlers/queueFileHandler';
import { SERVICES } from '../common/constants';
import logger from '../common/logger';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(config: ProviderConfig): S3Provider | NFSProvider {
  const queueFileHandler: QueueFileHandler = container.resolve(SERVICES.QUEUE_FILE_HANDLER);
  if (config.type === 'S3') {
    return new S3Provider(config, logger, queueFileHandler);
  }
  return new NFSProvider(config, logger, queueFileHandler);
}

function getProviderManager(providerConfiguration: ProvidersConfig): ProviderManager {
  return {
    ingestion: getProvider(providerConfiguration.ingestion),
    delete: getProvider(providerConfiguration.delete),
  };
}

export { getProvider, getProviderManager };
