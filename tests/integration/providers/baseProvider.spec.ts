import fs from 'node:fs';
import os from 'node:os';
import jsLogger, { Logger } from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { Tracer } from '@opentelemetry/api';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { NFSConfig } from '../../../src/common/interfaces';
import { QueueFileHandler } from '../../../src/handlers/queueFileHandler';
import { BaseProvider } from '../../../src/providers/baseProvider';
import { AppError } from '../../../src/common/appError';
import { NFSProvider } from '../../../src/providers/nfsProvider';

// ToDo those are UNIT tests, NOT INTEGRATION!! But CI requires integration coverage
describe('Crawling tests', () => {
  let crawler: BaseProvider<NFSConfig>;
  let queueFileHandler: QueueFileHandler;
  const logger: Logger = jsLogger({ enabled: false });

  const queueFilePath = os.tmpdir();
  const config: NFSConfig = {
    extension: '.json',
    nestedJsonPath: "$..['uri','url']",
    ignoreNotFound: false,
    pvPath: 'test_pv_path',
  };

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: logger } },
        {
          token: SERVICES.PROVIDER_CONFIG,
          provider: {
            useValue: {
              ...config,
            },
          },
        },
      ],
    });
    queueFileHandler = container.resolve(QueueFileHandler);
    const tracer = container.resolve<Tracer>(SERVICES.TRACER);
    crawler = new NFSProvider(logger, tracer, config, queueFileHandler);
  });

  afterAll(function () {
    container.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('streamModelPathsToQueueFile', () => {
    const json0 = {
      root: {
        content: { uri: 'a.b3dm', boundingVolume: { region: [0] } },
        children: [
          { boundingVolume: { region: [0, 1, 2, 3, 4, 5] }, geometricError: 0, content: { uri: 'b.b3dm' } },
          { boundingVolume: { region: [0, 1, 2, 3, 4, 5] }, geometricError: 0, content: { url: '../1.json' }, children: [] },
        ],
      },
    };
    const json1 = { root: { content: { uri: 'bla/c.b3dm' }, children: [{ content: { url: '2.json' } }] } };
    const json2 = {};
    const pathToTileset = '/x/y/0.json';

    it('should returns all the files', async () => {
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const getFileSpy = jest.spyOn(crawler, 'getFile');

      // eslint-disable-next-line @typescript-eslint/require-await
      getFileSpy.mockImplementation(async (path) => {
        const normalizedPath = path.replace(/\\/g, '/').replace(/^\//, '');

        if (normalizedPath === 'x/y/0.json') {
          return Buffer.from(JSON.stringify(json0));
        }
        if (normalizedPath === 'x/1.json') {
          return Buffer.from(JSON.stringify(json1));
        }
        if (normalizedPath === 'x/2.json') {
          return Buffer.from(JSON.stringify(json2));
        }
        return Buffer.from('content');
      });

      await queueFileHandler.createQueueFile(modelId);
      const total = await crawler.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);

      const result = fs.readFileSync(`${queueFilePath}/${modelId}`, 'utf-8').trim().split('\n');

      expect(total).toBe(6);
      expect(result).toEqual(
        expect.arrayContaining([expect.stringContaining('x/y/0.json'), expect.stringContaining('x/1.json'), expect.stringContaining('x/2.json')])
      );
      getFileSpy.mockRestore();
    });

    describe('getFile errors', () => {
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const createCrawler = (overrides: Partial<NFSConfig> = {}) =>
        new NFSProvider(logger, container.resolve(SERVICES.TRACER), { ...config, ...overrides }, queueFileHandler);

      it('should throw on a general getFile error', async () => {
        const getFileSpy = jest
          .spyOn(crawler, 'getFile')
          .mockRejectedValueOnce(new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Internal error', false));

        await expect(crawler.streamModelPathsToQueueFile(modelId, pathToTileset, modelName)).rejects.toThrow(AppError);

        getFileSpy.mockRestore();
      });

      it('should throw on NOT_FOUND when ignoreNotFound is false', async () => {
        const getFileSpy = jest.spyOn(crawler, 'getFile').mockRejectedValueOnce(new AppError(StatusCodes.NOT_FOUND, 'Not Found', false));

        await expect(crawler.streamModelPathsToQueueFile(modelId, pathToTileset, modelName)).rejects.toThrow(AppError);

        getFileSpy.mockRestore();
      });

      it('should skip NOT_FOUND files when ignoreNotFound is true', async () => {
        const ignoringCrawler = createCrawler({ ignoreNotFound: true });
        const getFileSpy = jest.spyOn(ignoringCrawler, 'getFile').mockRejectedValue(new AppError(StatusCodes.NOT_FOUND, 'Not Found', false));

        await expect(ignoringCrawler.streamModelPathsToQueueFile(modelId, pathToTileset, modelName)).resolves.toBe(0);

        getFileSpy.mockRestore();
      });
    });
  });
});
