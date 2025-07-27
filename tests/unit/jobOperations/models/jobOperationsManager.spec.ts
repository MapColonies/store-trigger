import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import httpStatus from 'http-status-codes';
import { faker } from '@faker-js/faker';
import { container } from 'tsyringe';
import { register } from 'prom-client';
import { getApp } from '../../../../src/app';
import { AppError } from '../../../../src/common/appError';
import { SERVICES } from '../../../../src/common/constants';
import { DeletePayload, JobOperationResponse, Payload } from '../../../../src/common/interfaces';
import { JobOperationsManager } from '../../../../src/jobOperations/models/jobOperationsManager';
import {
  configProviderMock,
  createPayload,
  jobManagerClientMock,
  queueFileHandlerMock,
  createFile,
  createJobParameters,
} from '../../../helpers/mockCreator';

let jobOperationsManager: JobOperationsManager;
let payload: Payload;

describe('jobOperationsManager', () => {
  beforeEach(() => {
    payload = createPayload('model');

    getApp({
      override: [
        { token: SERVICES.QUEUE_FILE_HANDLER, provider: { useValue: queueFileHandlerMock } },
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.PROVIDER, provider: { useValue: configProviderMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      ],
    });

    register.clear();
    jobOperationsManager = container.resolve(JobOperationsManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    register.clear();
  });

  describe('getActiveIngestionJobs Service', () => {
    it('returns create job response', async () => {
      const jobParameters = createJobParameters();
      const expectedResponse = [jobParameters];
      jobManagerClientMock.findJobs.mockResolvedValue(expectedResponse);
      const activeJobsResponse = await jobOperationsManager.getActiveIngestionJobs();
      expect(expectedResponse).toMatchObject(activeJobsResponse);
    });

    it('rejects if jobManager fails', async () => {
      // Arrange
      jobManagerClientMock.findJobs.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));
      // Act && Assert
      await expect(jobOperationsManager.getActiveIngestionJobs()).rejects.toThrow(AppError);
    });
  });

  describe('create Ingestion Job', () => {
    it('returns create job response', async () => {
      // Arrange
      const response: JobOperationResponse = {
        jobId: '1234',
        status: OperationStatus.PENDING,
      };
      jobManagerClientMock.createJob.mockResolvedValue({ id: '1234', status: OperationStatus.PENDING });
      // Act
      const modelResponse = await jobOperationsManager.createJob(payload);
      //Assert
      expect(modelResponse).toMatchObject(response);
    });

    it('rejects if jobManager fails', async () => {
      // Arrange
      jobManagerClientMock.createJob.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));
      // Act && Assert
      await expect(jobOperationsManager.createJob(payload)).rejects.toThrow(AppError);
    });
  });

  describe('createModel', () => {
    it('resolves without error when everything is ok', async () => {
      // Arrange
      const jobId = faker.string.uuid();
      const parameters = createJobParameters();
      const filesAmount = faker.number.int({ min: 1, max: 8 });
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
      const response = await jobOperationsManager.createModel(payload, jobId);

      //Assert
      expect(response).toBeUndefined();
    });

    it(`rejects if couldn't createQueueFile queue file`, async () => {
      // Arrange
      const jobId = faker.string.uuid();
      queueFileHandlerMock.createQueueFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));

      // Act && Assert
      await expect(jobOperationsManager.createModel(payload, jobId)).rejects.toThrow(AppError);
    });

    it(`rejects if couldn't empty queue file`, async () => {
      // Arrange
      const jobId = faker.string.uuid();
      queueFileHandlerMock.deleteQueueFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));

      // Act && Assert
      await expect(jobOperationsManager.createModel(payload, jobId)).rejects.toThrow(AppError);
    });

    it('rejects if the provider failed', async () => {
      // Arrange
      const jobId = faker.string.uuid();
      queueFileHandlerMock.createQueueFile.mockResolvedValue(undefined);
      configProviderMock.streamModelPathsToQueueFile.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));

      // Act && Assert
      await expect(jobOperationsManager.createModel(payload, jobId)).rejects.toThrow(AppError);
    });

    it(`rejects if couldn't read from queue file`, async () => {
      // Arrange
      const jobId = faker.string.uuid();
      const filesAmount = faker.number.int({ min: 1, max: 8 });
      queueFileHandlerMock.createQueueFile.mockResolvedValue(undefined);
      configProviderMock.streamModelPathsToQueueFile.mockResolvedValue(filesAmount);
      queueFileHandlerMock.readline.mockImplementation(() => {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true);
      });
      queueFileHandlerMock.deleteQueueFile.mockResolvedValue(undefined);

      // Act && Assert
      await expect(jobOperationsManager.createModel(payload, jobId)).rejects.toThrow(AppError);
    });

    it('rejects if there is a problem with job manager', async () => {
      // Arrange
      const jobId = faker.string.uuid();
      const filesAmount = faker.number.int({ min: 1, max: 8 });
      queueFileHandlerMock.createQueueFile.mockResolvedValue(undefined);
      configProviderMock.streamModelPathsToQueueFile.mockResolvedValue(filesAmount);
      for (let i = 0; i < filesAmount; i++) {
        queueFileHandlerMock.readline.mockReturnValueOnce(createFile());
      }
      queueFileHandlerMock.readline.mockReturnValueOnce(null);
      jobManagerClientMock.getJob.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));
      queueFileHandlerMock.deleteQueueFile.mockResolvedValue(undefined);

      // Act && Assert
      await expect(jobOperationsManager.createModel(payload, jobId)).rejects.toThrow(AppError);
    });
  });

  describe('validateDeleteJob method', () => {
    it('returns true if valid', async () => {
      jobManagerClientMock.findJobs.mockResolvedValue([]);
      // Act
      const isValid = await jobOperationsManager.validateDeleteJob('1234');
      //Assert
      expect(isValid).toBeTruthy();
    });

    it('fail if job is found for search criteria', async () => {
      const jobParameters = createJobParameters();
      // Arrange
      jobManagerClientMock.findJobs.mockResolvedValue([jobParameters]);
      // Act
      const isValid = await jobOperationsManager.validateDeleteJob('1234');
      //Assert
      expect(isValid).toBeFalsy();
    });

    it('rejects if jobManager fails', async () => {
      // Arrange
      jobManagerClientMock.findJobs.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));
      // Act && Assert
      await expect(jobOperationsManager.validateDeleteJob('1234')).rejects.toThrow(AppError);
    });
  });

  describe('createDeleteJob method', () => {
    it('returns true if valid', async () => {
      const payload: DeletePayload = {
        modelId: 'modelId',
        productId: 'productId',
        productVersion: 1,
        productType: 'productType',
        productName: 'productName',
        producerName: 'producerName',
      };

      const expectedResult: JobOperationResponse = {
        jobId: '1234',
        status: OperationStatus.IN_PROGRESS,
      };

      jobManagerClientMock.createJob.mockResolvedValue({ id: '1234' });
      // Act
      const deleteJobReponse = await jobOperationsManager.createDeleteJob(payload);
      //Assert
      expect(deleteJobReponse).toMatchObject(expectedResult);
    });

    it('rejects if jobManager fails', async () => {
      const payload: DeletePayload = {
        modelId: 'modelId',
        productId: 'productId',
        productVersion: 1,
        productType: 'productType',
        productName: 'productName',
        producerName: 'producerName',
      };
      // Arrange
      jobManagerClientMock.createJob.mockRejectedValue(new AppError(httpStatus.INTERNAL_SERVER_ERROR, '', true));
      // Act && Assert
      await expect(jobOperationsManager.createDeleteJob(payload)).rejects.toThrow(AppError);
    });
  });
});
