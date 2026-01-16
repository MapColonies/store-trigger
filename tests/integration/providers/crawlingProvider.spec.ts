import fs from 'fs';
import os from 'os';
import jsLogger, { Logger } from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { Tracer } from '@opentelemetry/api';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { CrawlingConfig } from '../../../src/common/interfaces';
import { QueueFileHandler } from '../../../src/handlers/queueFileHandler';
import { CrawlingProvider } from '../../../src/providers/crawlingProvider';
import { configProviderMock } from '../../helpers/mockCreator';
import { AppError } from '../../../src/common/appError';

// ToDo those are UNIT tests, NOT INTEGRATION!! But CI requires integration coverage
describe('CrawlingProvider tests', () => {
  let provider: CrawlingProvider;
  let queueFileHandler: QueueFileHandler;
  const logger: Logger = jsLogger({ enabled: false });

  const underlying = configProviderMock;
  const queueFilePath = os.tmpdir();
  const config: CrawlingConfig = {
    extension: '.json',
    nestedJsonPath: '$.root..uri',
    ignoreNotFound: false,
  };

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: logger } },
        { token: SERVICES.PROVIDER_CONFIG, provider: { useValue: config } },
        { token: SERVICES.UNDERLYING, provider: { useValue: underlying } },
      ],
    });
    provider = container.resolve(CrawlingProvider);
    queueFileHandler = container.resolve(QueueFileHandler);
  });

  afterAll(function () {
    container.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('is a stupid test just because coverage fails CI', () => {
      const tracer = container.resolve<Tracer>(SERVICES.TRACER);
      const provider = new CrawlingProvider(logger, tracer, config, underlying, queueFileHandler);
      expect(() => new CrawlingProvider(logger, tracer, config, provider, queueFileHandler)).toThrow(AppError);
    });
  });

  describe('getFile', () => {
    it('should delegate', async () => {
      const filePath = 'A test??';
      const buffetPromise = Promise.resolve(Buffer.from([80, 101, 114, 114, 121, 32, 116, 104, 101, 32, 116, 101, 115, 116, 63, 33, 63, 33]));
      underlying.getFile.mockResolvedValueOnce(buffetPromise);
      const file = await provider.getFile(filePath);
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

    it('should returns all the files from S3', async () => {
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      underlying.getFile
        .mockImplementationOnce((path) => {
          return path === pathToTileset && Buffer.from(JSON.stringify(json0), 'utf8');
        })
        .mockImplementationOnce((path) => {
          return path === '/x/1.json' && Buffer.from(JSON.stringify(json1), 'utf8');
        })
        .mockImplementationOnce((path) => {
          return path === '/x/2.json' && Buffer.from(JSON.stringify(json2), 'utf8');
        });

      const expected: string[] = ['/x/y/0.json', '/x/1.json', '/x/2.json', '/x/y/a.b3dm', '/x/y/b.b3dm', '/x/bla/c.b3dm'];
      await queueFileHandler.createQueueFile(modelId);

      await provider.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      const result = fs.readFileSync(`${queueFilePath}/${modelId}`, 'utf-8').trimEnd().split('\n');

      expect(result.sort().join('\n')).toBe(expected.sort().join('\n'));
      await queueFileHandler.deleteQueueFile(modelId);
    });

    it('should respect 404 ignore rules error on underlying.getFile error', async () => {
      const configWithIgnoreNotFound = { ...config, ignoreNotFound: true };
      const provider = new CrawlingProvider(logger, container.resolve(SERVICES.TRACER), configWithIgnoreNotFound, underlying, queueFileHandler);
      underlying.getFile.mockRejectedValueOnce(new AppError(StatusCodes.NOT_FOUND, 'blabla', false));
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const result = provider.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      await expect(result).resolves.not.toThrow();
    });

    it('should throw error on underlying.getFile error', async () => {
      underlying.getFile.mockRejectedValueOnce(new AppError(StatusCodes.NOT_FOUND, 'blabla', false));
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const result = provider.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      await expect(result).rejects.toThrow(AppError);
    });

    it('should throw error bad file', async () => {
      underlying.getFile.mockReturnValueOnce(Buffer.from('}{', 'utf8'));
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      const result = provider.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      await expect(result).rejects.toThrow(AppError);
    });
  });
});
