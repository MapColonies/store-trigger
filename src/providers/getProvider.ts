import config from 'config';
import httpStatus from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { AppError } from '../common/appError';
import { Provider, ProviderConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(provider: string, container: DependencyContainer): Provider {
  const childContainer = container.createChildContainer();
  childContainer.register(SERVICES.PROVIDER_CONFIG, { useValue: provider });
  switch (provider.toLowerCase()) {
    case 'nfs':
      return childContainer.resolve(NFSProvider);
    case 's3':
      return childContainer.resolve(S3Provider);
    default:
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Invalid config provider received: ${provider} - available values:  "nfs" or "s3"`, false);
  }
}

function getProviderConfig(container: string | DependencyContainer): ProviderConfig {
  const provider = typeof container == 'string' ? container : container.resolve<string>(SERVICES.PROVIDER_CONFIG);
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
