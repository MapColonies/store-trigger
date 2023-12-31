import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import httpStatusCodes from 'http-status-codes';
import { container } from 'tsyringe';
import { getApp } from '../../../../src/app';
import { SERVICES } from '../../../../src/common/constants';
import { Provider, ProviderManager } from '../../../../src/common/interfaces';
import { getProvider, getProviderManager } from '../../../../src/providers/getProvider';
import { ingestionJobPayload } from '../../../helpers/mockCreator';
import { JobsRequestSender } from '../helpers/requestSender';

describe('IngestionController on S3', function () {
  let requestSender: JobsRequestSender;
  let providerManager: ProviderManager;

  const jobManagerClientMock = {
    createIngestionJob: jest.fn(),
  };

  beforeAll(() => {
    const app = getApp({
      override: [
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER_MANAGER,
          provider: {
            useFactory: (): ProviderManager => {
              return getProviderManager();
            },
          },
        },
      ],
    });

    providerManager = container.resolve(SERVICES.PROVIDER_MANAGER);
    requestSender = new JobsRequestSender(app);
  });

  afterAll(function () {
    container.reset();
    jest.restoreAllMocks();
  });

  describe('POST /ingestion', function () {
    describe('Happy Path 🙂', function () {
      it('should return 201 status code and the added model', async function () {
        const payload = ingestionJobPayload('model1');
        jobManagerClientMock.createIngestionJob.mockResolvedValueOnce({ id: '1' });

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('jobID', '1');
        expect(response.body).toHaveProperty('status', OperationStatus.PENDING);
      });
    });

    describe('Sad Path 😥', function () {
      it('should return 500 status code if a network exception happens in job manager', async function () {
        const payload = ingestionJobPayload('bla');
        jobManagerClientMock.createIngestionJob.mockRejectedValueOnce(new Error('JobManager is not available'));

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'JobManager is not available');
      });
    });
  });
});

describe('IngestionController on NFS', function () {
  let requestSender: JobsRequestSender;
  const jobManagerClientMock = {
    createJob: jest.fn(),
  };

  beforeAll(() => {
    const app = getApp({
      override: [
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER_MANAGER,
          provider: {
            useFactory: (): ProviderManager => {
              return getProviderManager();
            },
          },
        },
      ],
    });

    requestSender = new JobsRequestSender(app);
  });

  afterAll(function () {
    container.reset();
    jest.restoreAllMocks();
  });

  describe('POST /ingestion', function () {
    describe('Happy Path 🙂', function () {
      it('should return 201 status code and the added model', async function () {
        const payload = ingestionJobPayload('model1');
        jobManagerClientMock.createJob.mockResolvedValueOnce({ id: '1' });

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('jobID', '1');
        expect(response.body).toHaveProperty('status', OperationStatus.PENDING);
      });
    });

    describe('Sad Path 😥', function () {
      it('should return 500 status code if a network exception happens in job manager', async function () {
        const payload = ingestionJobPayload('bla');
        jobManagerClientMock.createJob.mockRejectedValueOnce(new Error('JobManager is not available'));

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'JobManager is not available');
      });
    });
  });
});
