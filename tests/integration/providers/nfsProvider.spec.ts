import fs from 'fs';
import os from 'os';
import config from 'config';
import { container } from 'tsyringe';
import httpStatus from 'http-status-codes';
import { randUuid, randWord } from '@ngneat/falso';
import jsLogger from '@map-colonies/js-logger';
import { getApp } from '../../../src/app';
import { NFSProvider } from '../../../src/providers/nfsProvider';
import { SERVICES } from '../../../src/common/constants';
import { NFSConfig, ProviderManager } from '../../../src/common/interfaces';
import { AppError } from '../../../src/common/appError';
import { createFile, mockNFSNFS, queueFileHandlerMock } from '../../helpers/mockCreator';
import { QueueFileHandler } from '../../../src/handlers/queueFileHandler';
import { NFSHelper } from '../../helpers/nfsHelper';
import { getProviderManager } from '../../../src/providers/getProvider';

describe('NFSProvider tests', () => {
  let providerManager: ProviderManager;
  let queueFileHandler: QueueFileHandler;
  const queueFilePath = os.tmpdir();
  let nfsHelper: NFSHelper;

  beforeAll(() => {
    getApp({
      override: [
        {
          token: SERVICES.PROVIDER_MANAGER,
          provider: {
            useFactory: (): ProviderManager => {
              return getProviderManager(mockNFSNFS);
            },
          },
        },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      ],
    });
    providerManager = container.resolve(SERVICES.PROVIDER_MANAGER);
    queueFileHandler = container.resolve(QueueFileHandler);
    nfsHelper = new NFSHelper(mockNFSNFS.ingestion);
  });

  beforeEach(() => {
    nfsHelper.initNFS();
  });

  afterEach(async () => {
    await nfsHelper.cleanNFS();
    jest.clearAllMocks();
  });

  describe('streamModelPathsToQueueFile Function', () => {
    it('if model exists in the agreed folder, returns all the file paths of the model', async () => {
      const modelId = randUuid();
      await queueFileHandler.createQueueFile(modelId);
      const pathToTileset = randWord();
      const modelName = randWord();
      let expected = '';
      for (let i = 0; i < 4; i++) {
        const file = i === 3 ? `${i}${createFile(false, true)}` : `${i}${createFile()}`;
        await nfsHelper.createFileOfModel(pathToTileset, file);
        expected = `${expected}${pathToTileset}/${file}\n`;
      }

      await providerManager.ingestion.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      const result = fs.readFileSync(`${queueFilePath}/${modelId}`, 'utf-8');

      expect(result).toStrictEqual(expected);
      await queueFileHandler.deleteQueueFile(modelId);
    });

    it('if model does not exists in the agreed folder, throws error', async () => {
      const pathToTileset = randWord();
      const modelName = randWord();
      const modelId = randUuid();

      const result = async () => {
        await providerManager.ingestion.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      };

      await expect(result).rejects.toThrow(AppError);
    });

    it('if queue file handler does not work, throws error', async () => {
      getApp({
        override: [
          {
            token: SERVICES.PROVIDER_MANAGER,
            provider: {
              useFactory: (): ProviderManager => {
                return getProviderManager(mockNFSNFS);
              },
            },
          },
          { token: SERVICES.QUEUE_FILE_HANDLER, provider: { useValue: queueFileHandlerMock } },
          { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        ],
      });
      providerManager = container.resolve(SERVICES.PROVIDER_MANAGER);
      const pathToTileset = randWord();
      const modelName = randWord();
      const modelId = randUuid();
      const file = createFile();
      await nfsHelper.createFileOfModel(pathToTileset, file);
      queueFileHandlerMock.writeFileNameToQueueFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'queueFileHandler', false));

      const result = async () => {
        await providerManager.ingestion.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      };

      await expect(result).rejects.toThrow(AppError);
    });
  });
});
