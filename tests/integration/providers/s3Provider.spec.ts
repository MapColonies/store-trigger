import fs from 'fs';
import os from 'os';
import jsLogger from '@map-colonies/js-logger';
import { randNumber, randWord } from '@ngneat/falso';
import { container } from 'tsyringe';
import { AppError } from '../../../src/common/appError';
import { getApp } from '../../../src/app';
import { mockS3S3 } from '../../helpers/mockCreator'
import { SERVICES } from '../../../src/common/constants';
import { ProviderManager } from '../../../src/common/interfaces';
import { S3Helper } from '../../helpers/s3Helper';
import { QueueFileHandler } from '../../../src/handlers/queueFileHandler';
import { getProviderManager } from '../../../src/providers/getProvider';

describe('S3Provider tests', () => {
  let providerManager: ProviderManager;
  let s3Helper: S3Helper;
  let queueFileHandler: QueueFileHandler;

  const queueFilePath = os.tmpdir();

  beforeAll( () => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER_MANAGER,
          provider: {
            useFactory: (): ProviderManager => {
              return getProviderManager(mockS3S3);
            },
          },
        },
      ],
    });
    providerManager = container.resolve(SERVICES.PROVIDER_MANAGER);
    s3Helper = new S3Helper(mockS3S3.ingestion);
    queueFileHandler = container.resolve(QueueFileHandler);
  });

  beforeEach(async () => {
    await s3Helper.initialize();
  });

  afterEach(async () => {
    await s3Helper.terminate();
    jest.clearAllMocks();
  });

  describe('streamModelPathsToQueueFile', () => {
    it('returns all the files from S3', async () => {
      const modelId = randWord();
      const modelName = randWord();
      const pathToTileset = randWord();
      const fileLength = randNumber({ min: 1, max: 5 });
      const expectedFiles: string[] = [];
      for (let i = 0; i < fileLength; i++) {
        const file = randWord();
        await s3Helper.createFileOfModel(pathToTileset, file);
        expectedFiles.push(`${pathToTileset}/${file}`);
      }
      await queueFileHandler.createQueueFile(modelId);
      await s3Helper.createFileOfModel(pathToTileset, 'subDir/file');
      expectedFiles.push(`${pathToTileset}/subDir/file`);

      await providerManager.ingestion.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      const result = fs.readFileSync(`${queueFilePath}/${modelId}`, 'utf-8');

      for (const file of expectedFiles) {
        expect(result).toContain(file);
      }
      await queueFileHandler.deleteQueueFile(modelId);
    });

    it('returns error string when model is not in the agreed folder', async () => {
      const modelId = randWord();
      await queueFileHandler.createQueueFile(modelId);
      const modelName = randWord();
      const pathToTileset = randWord();

      const result = async () => {
        await providerManager.ingestion.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      };

      await expect(result).rejects.toThrow(AppError);
      await queueFileHandler.deleteQueueFile(modelId);
    });
  });
});
