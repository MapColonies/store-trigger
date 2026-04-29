import config from 'config';
import httpStatus from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { CrawlingInstance } from '../handlers/crawlingInstance';
import { AppError } from '../common/appError';
import { CrawlingConfig, Provider, ProviderConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

const PROVIDER_CONFIG = Symbol('ProviderConfig');
function getProvider(provider: string, container: DependencyContainer): Provider {
  const childContainer = container.createChildContainer();
  childContainer.register(PROVIDER_CONFIG, { useValue: provider });
  
  let BaseProvider: Provider;
  switch (provider.toLowerCase()) {
    case 'nfs':
      BaseProvider = childContainer.resolve(NFSProvider);
      break;
    case 's3':
      BaseProvider = childContainer.resolve(S3Provider);
      break;
    default:
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Invalid config provider received: ${provider}. Consult documentation for available values`,
        false
      );
  }

  try {
    const crawlingConfig = config.get<CrawlingConfig>('crawling');
    if (typeof crawlingConfig.underlying === 'string' && crawlingConfig.underlying.toLowerCase() === provider.toLowerCase()) {
      return new CrawlingInstance(
        childContainer.resolve(SERVICES.LOGGER),
        childContainer.resolve(SERVICES.TRACER),
        crawlingConfig,
        BaseProvider,
        childContainer.resolve(SERVICES.QUEUE_FILE_HANDLER)
      );
    }
  } catch (err) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed while configuring crawling, Consult documentation for available values`,
        false
      );
    }
  
  return BaseProvider;
}

function getProviderConfig(container: string | DependencyContainer): ProviderConfig {
  const provider = typeof container == 'string' ? container : container.resolve<string>(PROVIDER_CONFIG);
  try {
    return config.get(provider);
  } catch (err) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Invalid config provider received: ${provider}. Consult documentation for available values`,
      false
    );
  }
}

export { getProvider, getProviderConfig };
