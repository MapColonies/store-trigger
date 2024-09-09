import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import httpStatusCodes from 'http-status-codes';
import mockAxios from 'jest-mock-axios';
import { container } from 'tsyringe';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { JobStatusRequestSender } from './helpers/requestSender';

describe('jobStatusController', function () {
  let requestSender: JobStatusRequestSender;
  const jobManagerClientMock = {
    getJob: jest.fn(),
  };

  beforeAll(() => {
    const app = getApp({
      override: [
        { token: SERVICES.JOB_MANAGER_CLIENT, provider: { useValue: jobManagerClientMock } },
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      ],
    });

    requestSender = new JobStatusRequestSender(app);
  });

  afterAll(function () {
    container.reset();
    mockAxios.reset();
  });

  describe('GET /checkStatus', function () {
    describe('Happy Path', function () {
      it('should return 200 status code and the job status and percentage', async function () {
        const jobId = '1234';
        jobManagerClientMock.getJob.mockResolvedValue({ percentage: 100, status: OperationStatus.COMPLETED });

        const response = await requestSender.checkStatus(jobId);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveProperty('status', OperationStatus.COMPLETED);
        expect(response.body).toHaveProperty('percentage', 100);

        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Bad Path', function () {
      // All requests with status code of 400
    });

    describe('Sad Path', function () {
      it('should return 500 status code if job manager is unavailable', async function () {
        const jobId = '1234';
        jobManagerClientMock.getJob.mockRejectedValueOnce(new Error('JobManager is not available'));

        const response = await requestSender.checkStatus(jobId);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'JobManager is not available');

        expect(response).toSatisfyApiSpec();
      });
    });
  });
});
