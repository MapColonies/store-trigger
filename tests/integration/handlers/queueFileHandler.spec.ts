import fs from 'node:fs';
import { faker } from '@faker-js/faker';
import { QueueFileHandler } from '../../../src/handlers/queueFileHandler';

describe('QueueFileHandler', () => {
  let queueFileHandler: QueueFileHandler;
  const model = faker.word.sample();

  beforeEach(async () => {
    queueFileHandler = new QueueFileHandler();
    await queueFileHandler.createQueueFile(model);
  });

  afterEach(async () => {
    await queueFileHandler.deleteQueueFile(model);
  });

  describe('writeFileNameToQueueFile tests', () => {
    it('should write a file name to the queue file and read it', async () => {
      const fileName = 'test-file.txt';
      await queueFileHandler.writeFileNameToQueueFile(model, fileName);

      const line = queueFileHandler.readline(model);

      expect(line).toBe(fileName);
    });
  });

  describe('readline tests', () => {
    it('should return null when there is no data', () => {
      const line = queueFileHandler.readline(model);

      expect(line).toBeNull();
    });
  });

  describe('deleteQueueFile tests', () => {
    afterEach(async () => {
      await queueFileHandler.createQueueFile(model);
    });

    it('should delete the queue file', async () => {
      const response = await queueFileHandler.deleteQueueFile(model);

      expect(response).toBeUndefined();
    });
  });

  describe('checkIfTempFileEmpty tests', () => {
    it(`returns false if model's queue file is not empty`, async () => {
      const fileName = 'test-file.txt';
      await queueFileHandler.writeFileNameToQueueFile(model, fileName);

      const isExists = await queueFileHandler.checkIfTempFileEmpty(model);

      expect(isExists).toBe(false);
    });

    it(`returns true if model's queue file is empty`, async () => {
      const model = 'bla';
      await queueFileHandler.createQueueFile(model);

      const isExists = await queueFileHandler.checkIfTempFileEmpty(model);

      expect(isExists).toBe(true);
    });
  });

  describe('createQueueFile tests', () => {
    it('should create a queue file', async () => {
      const filePath = queueFileHandler['queueFilePath'];
      await queueFileHandler.deleteQueueFile(model);

      await queueFileHandler.createQueueFile(model);

      const fileExists = await fs.promises
        .access(filePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });
  });
});
