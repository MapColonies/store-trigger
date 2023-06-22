/* eslint-disable jest/no-commented-out-tests */
import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import httpStatusCodes from 'http-status-codes';
import { container } from 'tsyringe';
import { getApp } from '../../../../src/app';
import { SERVICES } from '../../../../src/common/constants';
import { IProvider } from '../../../../src/common/interfaces';
import { getProvider } from '../../../../src/providers/getProvider';
import { createPayload } from '../../../helpers/mockCreator';
import { IngestionRequestSender } from '../helpers/requestSender';

// Test
describe('IngestionController', function () {
  let requestSender: IngestionRequestSender;
  const jobManagerClientMock = {
    createJob: jest.fn(),
  };

  beforeAll(() => {
    const app = getApp({
      override: [
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER,
          provider: {
            useFactory: (): IProvider => {
              return getProvider('s3');
            },
          },
        },
      ],
    });

    requestSender = new IngestionRequestSender(app);
  });

  afterAll(function () {
    container.reset();
    jest.restoreAllMocks();
  });

  describe('POST /ingestion on S3', function () {
    describe('Happy Path 🙂', function () {
      it('should return 201 status code and the added model', async function () {
        const payload = createPayload('model1');
        jobManagerClientMock.createJob.mockResolvedValueOnce({ id: '1' });

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('jobID', '1');
        expect(response.body).toHaveProperty('status', OperationStatus.IN_PROGRESS);
      });
    });

    describe('Sad Path 😥', function () {
      it('should return 500 status code if a network exception happens in job manager', async function () {
        const payload = createPayload('bla');
        // s3Mock.on(ListObjectsCommand).resolves(s3Output);
        jobManagerClientMock.createJob.mockRejectedValueOnce(new Error('JobManager is not available'));

        const response = await requestSender.create(payload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'JobManager is not available');
      });
    });
  });
});
