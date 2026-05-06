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
import { Crawling } from '../../../src/providers/Crawling';
import { configProviderMock } from '../../helpers/mockCreator';
import { AppError } from '../../../src/common/appError';
import { NFSProvider } from '../../../src/providers/nfsProvider';

// ToDo those are UNIT tests, NOT INTEGRATION!! But CI requires integration coverage
describe('Crawling tests', () => {
  let crawler: Crawling<NFSConfig>;
  let queueFileHandler: QueueFileHandler;
  const logger: Logger = jsLogger({ enabled: false });

  const underlying = configProviderMock;
  const queueFilePath = os.tmpdir();
  const config: NFSConfig = {
    extension: '.json',
    nestedJsonPath: "$..['uri', 'url']",
    ignoreNotFound: false,
    pvPath: "test_pv_path",
  };

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: logger } },
        { token: SERVICES.PROVIDER_CONFIG, 
          provider: { 
            useValue: { 
              ...config, 
              ignoreNotFound: false, 
              extension: '.json',
              nestedJsonPath: "$..['uri','url']",
            } 
          } 
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


  describe('getFile', () => {
    it('should delegate', async () => {
      const filePath = 'A test??';
      const buffetPromise = Promise.resolve(Buffer.from([80, 101, 114, 114, 121, 32, 116, 104, 101, 32, 116, 101, 115, 116, 63, 33, 63, 33]));
      underlying.getFile.mockResolvedValueOnce(buffetPromise);
      const file = await crawler.getFile(filePath);
      expect(underlying.getFile).toHaveBeenCalledWith(filePath);
      expect(file.toString()).toBe('Perry the test?!?!');
    });
  });

  describe('streamModelPathsToQueueFile', () => {
    const json0 = {
      root: {
        content: { uri: 'a.b3dm', boundingVolume: { region: [0] } },
        children: [
          { boundingVolume: { region: [0, 1, 2, 3, 4, 5] }, geometricError: 0, content: { uri: 'b.b3dm' } },
          { boundingVolume: { region: [0, 1, 2, 3, 4, 5] }, geometricError: 0, content: { uri: '../1.json' }, children: [] },
        ],
      },
    };
    const json1 = { root: { content: { uri: 'bla/c.b3dm' }, children: [{ content: { uri: '2.json' } }] } };
    const json2 = {};
    const pathToTileset = '/x/y/0.json';

    it('should returns all the files', async () => {
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const getFileSpy = jest.spyOn(crawler, 'getFile');
      
      // eslint-disable-next-line @typescript-eslint/require-await
      getFileSpy.mockImplementation(async (path) => {
        const normalizedPath = path.replace(/\\/g, '/');
        if (normalizedPath === pathToTileset) {
          return Buffer.from(JSON.stringify(json0));
        }
        if (normalizedPath === '/x/1.json') {
          return Buffer.from(JSON.stringify(json1));
        }
        if (normalizedPath === '/x/2.json') {
          return Buffer.from(JSON.stringify(json2));
        }
        return Buffer.from('content');
      });

      await queueFileHandler.createQueueFile(modelId);
      const total = await crawler.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);

      const result = fs.readFileSync(`${queueFilePath}/${modelId}`, 'utf-8').trim().split('\n');
      
      expect(total).toBe(6);
      expect(result).toEqual(expect.arrayContaining(['/x/y/0.json', '/x/1.json', '/x/2.json']));
      
      getFileSpy.mockRestore();
    });

    it('should respect 404 ignore rules error on underlying.getFile error', async () => {
      const crawler = new NFSProvider(logger, container.resolve(SERVICES.TRACER), config, queueFileHandler);
      underlying.getFile.mockRejectedValueOnce(new AppError(StatusCodes.NOT_FOUND, 'blabla', false));
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const result = crawler.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      await expect(result).resolves.not.toThrow();
    });

    it('should throw error on underlying.getFile error', async () => {
      underlying.getFile.mockRejectedValueOnce(new AppError(StatusCodes.NOT_FOUND, 'blabla', false));
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const result = crawler.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      await expect(result).rejects.toThrow(AppError);
    });

    it('should throw error bad file', async () => {
      underlying.getFile.mockReturnValueOnce(Buffer.from('}{', 'utf8'));
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const result = crawler.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      await expect(result).rejects.toThrow(AppError);
    });
  });
});
