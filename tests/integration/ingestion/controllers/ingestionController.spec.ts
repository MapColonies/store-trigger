import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import httpStatusCodes from 'http-status-codes';
import { container } from 'tsyringe';
import { register } from 'prom-client';
import { getApp } from '../../../../src/app';
import { SERVICES } from '../../../../src/common/constants';
import { Provider } from '../../../../src/common/interfaces';
import { getProvider } from '../../../../src/providers/getProvider';
import { createJobPayload, createPayload } from '../../../helpers/mockCreator';
import { IngestionRequestSender } from '../helpers/requestSender';

describe('IngestionController on S3', function () {
  let requestSender: IngestionRequestSender;

  const jobManagerClientMock = {
    createJob: jest.fn(),
    findJobs: jest.fn(),
  };

  beforeEach(() => {
    register.clear();
    const app = getApp({
      override: [
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER,
          provider: {
            useFactory: (): Provider => {
              return getProvider('s3');
            },
          },
        },
      ],
    });

    requestSender = new IngestionRequestSender(app);
  });

  afterEach(function () {
    container.reset();
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('POST /ingestion', function () {
    describe('Happy Path 🙂', function () {
      it('should return 201 status code and the added model', async function () {
        const payload = createPayload('model1');
        jobManagerClientMock.createJob.mockResolvedValueOnce({ id: '1' });
        jobManagerClientMock.findJobs.mockResolvedValueOnce([]);

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('jobId', '1');
        expect(response.body).toHaveProperty('status', OperationStatus.PENDING);

        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Bad Path', function () {
      // All requests with status code of 400
      it('should return 400 status code if a network exception happens in job manager', async function () {
        const payload = createPayload('bla');
        const jobPayload = createJobPayload(payload);
        jobPayload.parameters.metadata.productName = payload.metadata.productName;
        jobManagerClientMock.createJob.mockResolvedValueOnce({ id: '1', productName: payload.metadata.productName });
        jobManagerClientMock.findJobs.mockResolvedValueOnce([jobPayload]);

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'Job Validation Failed');
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Sad Path 😥', function () {
      it('should return 500 status code if a network exception happens in job manager - createJob', async function () {
        const payload = createPayload('bla');
        jobManagerClientMock.createJob.mockRejectedValueOnce(new Error('JobManager is not available'));
        jobManagerClientMock.findJobs.mockResolvedValueOnce([]);

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'JobManager is not available');

        expect(response).toSatisfyApiSpec();
      });

      it('should return 500 status code if a network exception happens in job manager - findJobs', async function () {
        const payload = createPayload('bla');
        jobManagerClientMock.createJob.mockResolvedValueOnce({ id: '1' });
        jobManagerClientMock.findJobs.mockRejectedValueOnce(new Error('JobManager is not available'));

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'JobManager is not available');

        expect(response).toSatisfyApiSpec();
      });
    });
  });
});

describe('IngestionController on NFS', function () {
  let requestSender: IngestionRequestSender;
  const jobManagerClientMock = {
    createJob: jest.fn(),
    findJobs: jest.fn(),
  };

  beforeEach(() => {
    register.clear();
    const app = getApp({
      override: [
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER,
          provider: {
            useFactory: (): Provider => {
              return getProvider('nfs');
            },
          },
        },
      ],
    });

    requestSender = new IngestionRequestSender(app);
  });

  afterEach(function () {
    container.reset();
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('POST /ingestion', function () {
    describe('Happy Path 🙂', function () {
      it('should return 201 status code and the added model', async function () {
        const payload = createPayload('model1');
        jobManagerClientMock.createJob.mockResolvedValueOnce({ id: '1' });
        jobManagerClientMock.findJobs.mockResolvedValueOnce([]);

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('jobId', '1');
        expect(response.body).toHaveProperty('status', OperationStatus.PENDING);

        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Bad Path', function () {
      // All requests with status code of 400
      it('should return 400 status code if a job with same name exists in job manager', async function () {
        const payload = createPayload('bla');
        const payload2 = createPayload('bla2');
        const jobPayload = createJobPayload(payload);
        jobPayload.parameters.metadata.productName = payload.metadata.productName;
        jobManagerClientMock.createJob.mockResolvedValueOnce({ id: '1', productName: payload.metadata.productName });
        jobManagerClientMock.findJobs.mockResolvedValueOnce([jobPayload, payload2]);

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'Job Validation Failed');
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if job manager returns not an array object', async function () {
        const payload = createPayload('bla');
        const jobPayload = createJobPayload(payload);
        jobPayload.parameters.metadata.productName = payload.metadata.productName;
        jobManagerClientMock.createJob.mockResolvedValueOnce({ id: '1', productName: payload.metadata.productName });
        jobManagerClientMock.findJobs.mockResolvedValueOnce({});

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'Job Validation Failed');
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Sad Path 😥', function () {
      it('should return 500 status code if a network exception happens in job manager - createJob', async function () {
        const payload = createPayload('bla');
        jobManagerClientMock.createJob.mockRejectedValueOnce(new Error('JobManager is not available'));
        jobManagerClientMock.findJobs.mockResolvedValueOnce([]);

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'JobManager is not available');

        expect(response).toSatisfyApiSpec();
      });
    });
  });
});
