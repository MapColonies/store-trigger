import jsLogger from '@map-colonies/js-logger';
import { ICreateTaskBody, OperationStatus } from '@map-colonies/mc-priority-queue';
import { DependencyContainer } from 'tsyringe';
import { JobManagerWrapper } from '../../../src/clients/jobManagerWrapper';
import { getApp } from '../../../src/app';
import { CreateJobBody, ITaskParameters } from '../../../src/common/interfaces';
import { createJobParameters, createUuid, getBaseRegisterOptions } from '../../helpers/mockCreator';

describe('jobManagerWrapper', () => {
  let jobManagerWrapper: JobManagerWrapper;

  const jobsManagerMock = {
    createJob: jest.fn(),
  };

  let depContainer: DependencyContainer;

  beforeAll(() => {
    const { app, container } = getApp(getBaseRegisterOptions());
    depContainer = container;
    const registerOptions = getBaseRegisterOptions();
    registerOptions.override.push({ token: SERVICES.APPLICATION, provider: { useValue: appConfigWithRetries } });
  });
  
  beforeAll(() => {
    jobManagerWrapper = new JobManagerWrapper(jsLogger({ enabled: false }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create tests', () => {
    it(`should return the ingestion's response`, async () => {
      const modelId = createUuid();
      const tasks: ICreateTaskBody<ITaskParameters>[] = [
        {
          parameters: { paths: ['a'], modelId },
        },
      ];
      const job: CreateJobBody = {
        tasks: tasks,
        resourceId: 'bla',
        version: 's',
        type: 'bla',
        parameters: createJobParameters(),
      };
      jobsManagerMock.createJob.mockResolvedValue(job);

      const created = await jobManagerWrapper.create(job);

      expect(created).toHaveProperty('jobID');
      expect(created).toHaveProperty('status');
      expect(created.status).toBe(OperationStatus.IN_PROGRESS);
    });

    it(`should return an error when jobService is not avaliable`, async () => {
      const modelId = createUuid();
      const tasks: ICreateTaskBody<ITaskParameters>[] = [
        {
          parameters: { paths: ['a'], modelId },
        },
      ];
      const job: CreateJobBody = {
        tasks: tasks,
        resourceId: 'bla',
        version: 's',
        type: 'bla',
        parameters: createJobParameters(),
      };
      jobsManagerMock.createJob.mockRejectedValue(new Error('Job Service is not avaliable'));

      await expect(jobManagerWrapper.create(job)).rejects.toThrow('Job Service is not avaliable');
    });
  });
});
