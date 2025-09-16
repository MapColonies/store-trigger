import config from 'config';
import { Polygon } from 'geojson';
import { faker } from '@faker-js/faker';
import { Layer3DMetadata, ProductType, RecordStatus, RecordType } from '@map-colonies/mc-model-types';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { CreatDeleteJobBody, CreateIngestionJobBody, DeletePayload, IngestionJobParameters, Payload } from '../../src/common/interfaces';
import { DOMAIN } from '../../src/common/constants';

const maxResolutionMeter = 8000;
const noData = 999;
const maxAccuracySE90 = 250;
const maxRelativeAccuracyLEP90 = 100;
const maxVisualAccuracy = 100;

export const createFile = (isBlackFile = false, isHasSubDir = false): string => {
  const file = isHasSubDir ? `${faker.word.sample()}/${faker.word.sample()}` : faker.word.sample();
  return isBlackFile ? `${file}.zip` : `${file}.txt`;
};

export const createMetadata = (): Layer3DMetadata => {
  const footprint: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [1, 1],
        [1, 1],
        [1, 1],
        [1, 1],
      ],
    ],
  };
  return {
    productId: faker.string.uuid(),
    productName: faker.word.sample(),
    productType: ProductType.PHOTO_REALISTIC_3D,
    description: faker.word.words(),
    creationDate: faker.date.past(),
    sourceDateStart: faker.date.past(),
    sourceDateEnd: faker.date.past(),
    minResolutionMeter: faker.number.int({ max: maxResolutionMeter }),
    maxResolutionMeter: faker.number.int({ max: maxResolutionMeter }),
    maxAccuracyCE90: faker.number.int({ min: 0, max: noData }),
    absoluteAccuracyLE90: faker.number.int({ min: 0, max: noData }),
    accuracySE90: faker.number.int({ min: 0, max: maxAccuracySE90 }),
    relativeAccuracySE90: faker.number.int({ min: 0, max: maxRelativeAccuracyLEP90 }),
    visualAccuracy: faker.number.int({ min: 0, max: maxVisualAccuracy }),
    sensors: [faker.word.sample()],
    footprint,
    heightRangeFrom: faker.number.int(),
    heightRangeTo: faker.number.int(),
    srsId: faker.number.int().toString(),
    srsName: faker.word.sample(),
    region: [faker.word.sample()],
    classification: faker.word.sample(),
    productionSystem: faker.word.sample(),
    productionSystemVer: faker.word.sample(),
    producerName: faker.word.sample(),
    minFlightAlt: faker.number.int(),
    maxFlightAlt: faker.number.int(),
    geographicArea: faker.word.sample(),
    productStatus: RecordStatus.UNPUBLISHED,
    productBoundingBox: undefined,
    productVersion: undefined,
    type: RecordType.RECORD_3D,
    updateDate: undefined,
    productSource: faker.word.sample(),
  };
};

export const createPayload = (modelName: string): Payload => {
  return {
    modelId: faker.string.uuid(),
    pathToTileset: modelName,
    tilesetFilename: 'tileset.json',
    metadata: createMetadata(),
  };
};

export const createDeletePayload = (): DeletePayload => {
  return {
    modelId: faker.string.uuid(),
    productId: faker.string.uuid(),
    producerName: faker.word.sample(),
    productName: faker.word.sample(),
    productType: faker.word.sample(),
    productVersion: 1,
  };
};

export const createDeleteJobPayload = (payload: DeletePayload): CreatDeleteJobBody => {
  return {
    resourceId: payload.modelId,
    version: '1',
    type: config.get<string>('jobManager.delete.taskType'),
    parameters: {
      modelId: payload.modelId,
    },
    productType: payload.productType,
    productName: payload.productName,
    producerName: payload.producerName,
    percentage: 0,
    status: OperationStatus.IN_PROGRESS,
    domain: DOMAIN,
  };
};

export const createJobPayload = (payload: Payload): CreateIngestionJobBody => {
  return {
    resourceId: payload.modelId,
    version: '1',
    type: config.get<string>('jobManager.ingestion.taskType'),
    parameters: createJobParameters(),
    productType: payload.metadata.productType,
    productName: payload.metadata.productName,
    percentage: 0,
    producerName: payload.metadata.producerName,
    status: OperationStatus.PENDING,
    domain: '3D',
  };
};

export const createJobParameters = (): IngestionJobParameters => {
  return {
    metadata: createMetadata(),
    modelId: faker.string.uuid(),
    tilesetFilename: 'tileset.json',
    filesCount: 0,
    pathToTileset: 'path/to/tileset',
  };
};

export const queueFileHandlerMock = {
  deleteQueueFile: jest.fn(),
  readline: jest.fn(),
  createQueueFile: jest.fn(),
  writeFileNameToQueueFile: jest.fn(),
};

export const jobManagerClientMock = {
  createJob: jest.fn(),
  findJobs: jest.fn(),
  createTaskForJob: jest.fn(),
  getJob: jest.fn(),
  updateJob: jest.fn(),
};

export const configProviderMock = {
  streamModelPathsToQueueFile: jest.fn(),
  getFile: jest.fn(),
};
