import fs from 'node:fs';
import os from 'node:os';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { faker } from '@faker-js/faker';
import { AppError } from '../../../src/common/appError';
import { S3Provider } from '../../../src/providers/s3Provider';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { S3Config } from '../../../src/common/interfaces';
import { S3Helper } from '../../helpers/s3Helper';
import { QueueFileHandler } from '../../../src/handlers/queueFileHandler';

describe('S3Provider tests', () => {
  let provider: S3Provider;
  let s3Helper: S3Helper;
  let queueFileHandler: QueueFileHandler;

  const queueFilePath = os.tmpdir();
  const s3Config = config.get<S3Config>('S3');

  beforeAll(async () => {
    container.reset();
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER_CONFIG,
          provider: {
            useValue: {
              ...s3Config,
              ignoreNotFound: false,
              extension: '.json',
              nestedJsonPath: "$..['uri','url']",
            },
          },
        },
      ],
    });
    provider = container.resolve(S3Provider);
    s3Helper = container.resolve(S3Helper);
    queueFileHandler = container.resolve(QueueFileHandler);

    await s3Helper.createBucket();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await s3Helper.clearBucket();
    await s3Helper.deleteBucket();
    s3Helper.killS3();
  });

  describe('getFile', () => {
    it(`When calling getFile, should see the file content from source bucket`, async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const expected = await s3Helper.createFileOfModel(model, file);

      const result = await provider.getFile(`${model}/${file}`);

      expect(result).toStrictEqual(expected);
    });

    it(`When the file is not exists in the bucket, throws error`, async () => {
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;

      const result = async () => {
        await provider.getFile(file);
      };

      await expect(result).rejects.toThrow(Error);
    });
  });

  describe('streamModelPathsToQueueFile', () => {
    it('should recursively discover nested files across multiple directories and levels', async () => {
      const modelId = faker.string.uuid();
      const modelName = 'complex-model';

      const rootTileset = 'tileset.json';
      const subDir = 'folderA';
      const secondLevelJson = `${subDir}/sub-tileset.json`;
      const leafFileJson = `${subDir}/data.json`;
      const leafFileBinary = `${subDir}/geometry.b3dm`;

      const rootContent = JSON.stringify({
        root: { uri: secondLevelJson, url: secondLevelJson },
      });

      const subTilesetContent = JSON.stringify({
        buffers: [{ uri: 'data.json' }, { url: 'geometry.b3dm' }],
      });

      await s3Helper.createFileOfModel('', rootTileset, rootContent);
      await s3Helper.createFileOfModel('', secondLevelJson, subTilesetContent);
      await s3Helper.createFileOfModel('', leafFileJson, JSON.stringify({}));
      await s3Helper.createFileOfModel('', leafFileBinary, Buffer.from('fake-binary-data'));

      await queueFileHandler.createQueueFile(modelId);

      const totalAdded = await provider.streamModelPathsToQueueFile(modelId, rootTileset, modelName);

      const result = fs.readFileSync(`${queueFilePath}/${modelId}`, 'utf-8');
      const filesInQueue = result
        .trim()
        .split('\n')
        .map((l) => l.trim());

      expect(totalAdded).toBe(4);

      expect(filesInQueue).toContain(rootTileset);
      expect(filesInQueue).toContain(secondLevelJson);
      expect(filesInQueue).toContain(leafFileJson);
      expect(filesInQueue).toContain(leafFileBinary);

      await queueFileHandler.deleteQueueFile(modelId);
    });

    it('returns error string when model is not in the agreed folder', async () => {
      const modelId = faker.word.sample();
      await queueFileHandler.createQueueFile(modelId);
      const modelName = faker.word.sample();
      const pathToTileset = faker.word.sample();

      const result = async () => {
        await provider.streamModelPathsToQueueFile(modelId, pathToTileset, modelName);
      };

      await expect(result).rejects.toThrow(AppError);
      await queueFileHandler.deleteQueueFile(modelId);
    });
  });
});
