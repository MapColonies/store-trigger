import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { getProvider } from '../../../src/providers/getProvider';
import { CrawlingProvider } from '../../../src/providers/crawlingProvider';
import { NFSProvider } from '../../../src/providers/nfsProvider';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';

describe('getProvider tests', () => {
  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.PROVIDER, provider: { useFactory: (container) => getProvider('crawling', container) } },
      ],
    });
  });

  afterAll(function () {
    container.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should recursively load provider', () => {
    const provider = getProvider('crawling', container);
    expect(provider).toBeInstanceOf(CrawlingProvider);
    const crawlingProviderInstance = provider as CrawlingProvider;
    // @ts-expect-error Accessing protected member
    expect(crawlingProviderInstance.config).toEqual(config.get('crawling'));
    // @ts-expect-error Accessing protected member
    expect(crawlingProviderInstance.underlying).toBeInstanceOf(NFSProvider);
    // @ts-expect-error Accessing protected member
    const underlying = crawlingProviderInstance.underlying as NFSProvider;
    // @ts-expect-error Accessing protected member
    expect(underlying.config).toEqual(config.get('NFS'));
  });
});
