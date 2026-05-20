import fs from 'node:fs';
import os from 'node:os';
import config from 'config';
import { container } from 'tsyringe';
import httpStatus from 'http-status-codes';
import jsLogger from '@map-colonies/js-logger';
import { register } from 'prom-client';
import { faker } from '@faker-js/faker';
import { getApp } from '../../../src/app';
import { NFSProvider } from '../../../src/providers/nfsProvider';
import { SERVICES } from '../../../src/common/constants';
import { BaseProviderConfig, NFSConfig } from '../../../src/common/interfaces';
import { AppError } from '../../../src/common/appError';
import { createFile, queueFileHandlerMock } from '../../helpers/mockCreator';
import { QueueFileHandler } from '../../../src/handlers/queueFileHandler';
import { NFSHelper } from '../../helpers/nfsHelper';

describe('NFSProvider tests', () => {
  let provider: NFSProvider;
  let queueFileHandler: QueueFileHandler;
  const queueFilePath = os.tmpdir();
  const nfsConfig = { ...config.get<NFSConfig>('NFS'), ...config.get<BaseProviderConfig>('crawling') };
  let nfsHelper: NFSHelper;

  beforeAll(() => {
    register.clear();
    getApp({
      override: [
        { token: SERVICES.PROVIDER_CONFIG, provider: { useValue: nfsConfig } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      ],
    });
    provider = container.resolve(NFSProvider);
    queueFileHandler = container.resolve(QueueFileHandler);
    nfsHelper = new NFSHelper(nfsConfig);
  });

  beforeEach(() => {
    nfsHelper.initNFS();
  });

  afterEach(async () => {
    await nfsHelper.cleanNFS();
    jest.clearAllMocks();
  });

  describe('getFile', () => {
    it('When calling getFile, should get the file content from pv path', async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const fileContent = await nfsHelper.createFileOfModel(model, file);

      const bufferResult = await provider.getFile(`${model}/${file}`);
      const result = bufferResult.toString();

      expect(result).toStrictEqual(fileContent);
    });
  });

  describe('streamModelPathsToQueueFile Function', () => {
    it('if model exists and contains valid JSON, returns linked file paths', async () => {
      const modelId = faker.string.uuid();
      const modelName = 'interconnect';
      const entryFile = 'tileset.json';
      const pathToTileset = `${modelName}/${entryFile}`;

      await queueFileHandler.createQueueFile(modelId);

      const textureFile = 'text1.png';
      const childTileset = 'child.json';

      const tilesetContent = JSON.stringify({
        root: {
          content: { uri: childTileset },
          children: [{ content: { uri: textureFile } }],
        },
      });

      await nfsHelper.createFileOfModel('', pathToTileset, tilesetContent);

      await nfsHelper.createFileOfModel(modelName, textureFile, 'data');
      await nfsHelper.createFileOfModel(modelName, childTileset, JSON.stringify({ asset: { version: '1.0' } }));

      await provider.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);

      const result = fs.readFileSync(`${queueFilePath}/${modelId}`, 'utf-8');

      expect(result).toContain(pathToTileset);
      await queueFileHandler.deleteQueueFile(modelId);
    });

    it('if model does not exists in the agreed folder, throws error', async () => {
      const pathToTileset = faker.word.sample();
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();

      (provider as unknown as { config: BaseProviderConfig }).config.ignoreNotFound = false;

      const result = async () => {
        await provider.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      };

      await expect(result).rejects.toThrow(AppError);
    });

    it('if queue file handler does not work, throws error', async () => {
      register.clear();
      getApp({
        override: [
          { token: SERVICES.PROVIDER_CONFIG, provider: { useValue: nfsConfig } },
          { token: SERVICES.QUEUE_FILE_HANDLER, provider: { useValue: queueFileHandlerMock } },
          { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        ],
      });
      provider = container.resolve(NFSProvider);
      const pathToTileset = faker.word.sample();
      const modelName = faker.word.sample();
      const modelId = faker.string.uuid();
      const file = createFile();
      await nfsHelper.createFileOfModel(pathToTileset, file);
      queueFileHandlerMock.writeFileNameToQueueFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'queueFileHandler', false));

      const result = async () => {
        await provider.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      };

      await expect(result).rejects.toThrow(AppError);
    });
  });
});
