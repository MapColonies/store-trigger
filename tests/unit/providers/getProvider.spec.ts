import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import config from 'config';
import { container } from 'tsyringe';
import { getProvider, getProviderConfig } from '../../../src/providers/getProvider';
import { SERVICES, SERVICE_NAME } from '../../../src/common/constants';
import { NFSProvider } from '../../../src/providers/nfsProvider';
import { S3Provider } from '../../../src/providers/s3Provider';
import {
  configProviderMock,
  jobManagerClientMock,
  queueFileHandlerMock,
} from '../../helpers/mockCreator';

jest.mock('config', () => ({
  get: jest.fn((key: string) => {
    switch (key) {
      case 'NFS':
        return { pvPath: '/tmp', extension: '.json', nestedJsonPath: "$..['uri','url']" };
      case 'S3':
        return { bucket: 'test-bucket', extension: '.json', nestedJsonPath: "$..['uri','url']" };
      default:
        return {};
    }
  }),
}));

describe('getProvider tests', () => {
  beforeEach(() => {
    container.reset();
    jest.clearAllMocks();

    const tracer = trace.getTracer(SERVICE_NAME);

    container.register(SERVICES.LOGGER, { useValue: jsLogger({ enabled: false })});
    container.register(SERVICES.TRACER, { useValue: tracer });
    container.register(SERVICES.QUEUE_FILE_HANDLER, { useValue: queueFileHandlerMock });
    container.register(SERVICES.JOB_MANAGER_CLIENT, { useValue: jobManagerClientMock });
    container.register(SERVICES.PROVIDER, { useValue: configProviderMock });
  });

  describe('getProvider nfs', () => {
    it('should load an instance of the nfs provider', () => {
      const provider = getProvider('nfs', container);
      expect(provider).toBeInstanceOf(NFSProvider);
    });
  });

  describe('getProvider s3', () => {
    it('should load an instance of the s3 provider', () => {
      const provider = getProvider('s3', container);
      expect(provider).toBeInstanceOf(S3Provider);
    });
  });

  describe('getProvider invalid', () => {
    it('should throw an AppError for an unknown provider', () => {
      expect(() => getProvider('invalid', container)).toThrow(
        'Invalid config provider received: invalid - available values:  "nfs" or "s3"'
      );
    });
  });

  describe('config failures', () => {
    it('should throw when config.get fails', () => {
      (config.get as jest.Mock).mockImplementationOnce(() => {
        throw new Error('config failure');
      });

      expect(() => getProviderConfig('NFS')).toThrow(
        'Invalid config provider received: NFS. Consult documentation for available values'
      );
    });
  });
});
