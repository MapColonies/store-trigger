import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { getProvider } from '../../../src/providers/getProvider';
import { CrawlingInstance } from '../../../src/handlers/crawlingInstance';
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
    const provider = getProvider('nfs', container);
    expect(provider).toBeInstanceOf(CrawlingInstance);
  });
});
