import config from 'config';
import httpStatus from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { AppError } from '../common/appError';
import { Provider, ProviderConfig } from '../common/interfaces';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(provider: string, container: DependencyContainer): Provider {
  switch (provider.toLowerCase()) {
    case 'nfs':
      return container.resolve(NFSProvider);
    case 's3':
      return container.resolve(S3Provider);
    default:
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Invalid config provider received: ${provider} - available values:  "nfs" or "s3"`, false);
  }
}

function getProviderConfig(provider: string): ProviderConfig {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const providerConfig = config.get(provider) as ProviderConfig;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const crawlingConfig = config.get('crawling') as Record<string, unknown>;
      return { ...providerConfig, ...crawlingConfig } as ProviderConfig;
    } catch (err) {
      return providerConfig;
    }
  } catch (err) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Invalid config provider received: ${provider}. Consult documentation for available values`,
      false
    );
  }
}

export { getProvider, getProviderConfig };
