import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { randNumber } from '@ngneat/falso';
import httpStatus from 'http-status-codes';
import { container } from 'tsyringe';
import { getApp } from '../../../../src/app';
import { AppError } from '../../../../src/common/appError';
import { SERVICES } from '../../../../src/common/constants';
import { JobsResponse, IngestionPayload } from '../../../../src/common/interfaces';
import { JobsManager } from '../../../../src/jobs/models/jobsManager';
import {
  configProviderMock,
  ingestionPayload,
  jobManagerClientMock,
  queueFileHandlerMock,
  createFile,
  createIngestionJobParameters,
} from '../../../helpers/mockCreator';

let jobsManager: JobsManager;
let payload: IngestionPayload;

describe('ingestionManager', () => {
  beforeEach(() => {
    payload = ingestionPayload('model');

    getApp({
      override: [
        { token: SERVICES.QUEUE_FILE_HANDLER, provider: { useValue: queueFileHandlerMock } },
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.PROVIDER, provider: { useValue: configProviderMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      ],
    });

    jobsManager = container.resolve(JobsManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob Service', () => {
    it('returns create job response', async () => {
      // Arrange
      const response: JobsResponse = {
        jobID: '1234',
        status: OperationStatus.PENDING,
      };
      jobManagerClientMock.createJob.mockResolvedValue({ id: '1234', status: OperationStatus.PENDING });
      // Act
      const modelResponse = await jobsManager.createIngestionJob(payload);
      //Assert
      expect(modelResponse).toMatchObject(response);
    });

    it('rejects if jobManager fails', async () => {
      // Arrange
      jobManagerClientMock.createJob.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));
      // Act && Assert
      await expect(jobsManager.createIngestionJob(payload)).rejects.toThrow(AppError);
    });
  });

  describe('createModel Service', () => {
    it('resolves without error when everything is ok', async () => {
      // Arrange
      const parameters = createIngestionJobParameters();
      const filesAmount = randNumber({ min: 1, max: 8 });
      queueFileHandlerMock.createQueueFile.mockResolvedValue(undefined);
      configProviderMock.streamModelPathsToQueueFile.mockResolvedValue(filesAmount);
      for (let i = 0; i < filesAmount; i++) {
        queueFileHandlerMock.readline.mockReturnValueOnce(createFile());
      }
      queueFileHandlerMock.readline.mockReturnValueOnce(createFile(true));
      queueFileHandlerMock.readline.mockReturnValueOnce(null);
      jobManagerClientMock.getJob.mockResolvedValue({ parameters });
      jobManagerClientMock.updateJob.mockResolvedValue(undefined);
      queueFileHandlerMock.deleteQueueFile.mockResolvedValue(undefined);

      // Act
      const response = await jobsManager.createIngestionJob(payload);

      //Assert
      expect(response).toBeUndefined();
    });

    it(`rejects if couldn't createQueueFile queue file`, async () => {
      // Arrange
      queueFileHandlerMock.createQueueFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));

      // Act && Assert
      await expect(jobsManager.createIngestionJob(payload)).rejects.toThrow(AppError);
    });

    it(`rejects if couldn't empty queue file`, async () => {
      // Arrange
      queueFileHandlerMock.deleteQueueFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));

      // Act && Assert
      await expect(jobsManager.createIngestionJob(payload)).rejects.toThrow(AppError);
    });

    it('rejects if the provider failed', async () => {
      // Arrange
      queueFileHandlerMock.createQueueFile.mockResolvedValue(undefined);
      configProviderMock.streamModelPathsToQueueFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));

      // Act && Assert
      await expect(jobsManager.createIngestionJob(payload)).rejects.toThrow(AppError);
    });

    it(`rejects if couldn't read from queue file`, async () => {
      // Arrange
      const filesAmount = randNumber({ min: 1, max: 8 });
      queueFileHandlerMock.createQueueFile.mockResolvedValue(undefined);
      configProviderMock.streamModelPathsToQueueFile.mockResolvedValue(filesAmount);
      queueFileHandlerMock.readline.mockImplementation(() => {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true);
      });
      queueFileHandlerMock.deleteQueueFile.mockResolvedValue(undefined);

      // Act && Assert
      await expect(jobsManager.createIngestionJob(payload)).rejects.toThrow(AppError);
    });

    it('rejects if there is a problem with job manager', async () => {
      // Arrange
      const filesAmount = randNumber({ min: 1, max: 8 });
      queueFileHandlerMock.createQueueFile.mockResolvedValue(undefined);
      configProviderMock.streamModelPathsToQueueFile.mockResolvedValue(filesAmount);
      for (let i = 0; i < filesAmount; i++) {
        queueFileHandlerMock.readline.mockReturnValueOnce(createFile());
      }
      queueFileHandlerMock.readline.mockReturnValueOnce(null);
      jobManagerClientMock.getJob.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));
      queueFileHandlerMock.deleteQueueFile.mockResolvedValue(undefined);

      // Act && Assert
      await expect(jobsManager.createIngestionJob(payload)).rejects.toThrow(AppError);
    });
  });
});
