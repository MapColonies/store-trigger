import config from 'config';
import httpStatus from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { AppError } from '../common/appError';
import { CrawlingConfig, Provider, ProviderConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';
import { CrawlingProvider } from './crawlingProvider';

const PROVIDER_CONFIG = Symbol('ProviderConfig');
function getProvider(provider: string, container: DependencyContainer): Provider {
  const childContainer = container.createChildContainer();
  childContainer.register(PROVIDER_CONFIG, { useValue: provider });
  switch (provider.toLowerCase()) {
    case 'nfs':
      return childContainer.resolve(NFSProvider);
    case 's3':
      return childContainer.resolve(S3Provider);
    case 'crawling': {
      const underlying = childContainer.resolve<CrawlingConfig>(SERVICES.PROVIDER_CONFIG).underlying!;
      childContainer.register(SERVICES.UNDERLYING, {
        useFactory: (childContainer) => getProvider(underlying, childContainer),
      });
      return childContainer.resolve(CrawlingProvider);
    }
    default:
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Invalid config provider received: ${provider}. Consult documentation for available values`,
        false
      );
  }
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
