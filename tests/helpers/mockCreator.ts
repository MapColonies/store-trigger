import config from 'config';
import { randNumber, randPastDate, randSentence, randUuid, randWord } from '@ngneat/falso';
import { Polygon } from 'geojson';
import { Layer3DMetadata, ProductType, RecordStatus, RecordType } from '@map-colonies/mc-model-types';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { CreateJobBody, IngestionJobParameters as IngestionJobParameters, IngestionPayload as IngestionPayload } from '../../src/common/interfaces';

const maxResolutionMeter = 8000;
const noData = 999;
const maxAccuracySE90 = 250;
const maxRelativeAccuracyLEP90 = 100;
const maxVisualAccuracy = 100;

export const createUuid = (): string => {
  return randUuid();
};

export const createFile = (isBlackFile = false, isHasSubDir = false): string => {
  const file = isHasSubDir ? `${randWord()}/${randWord()}` : randWord();
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
    productId: randUuid(),
    productName: randWord(),
    productType: ProductType.PHOTO_REALISTIC_3D,
    description: randSentence(),
    creationDate: randPastDate(),
    sourceDateStart: randPastDate(),
    sourceDateEnd: randPastDate(),
    minResolutionMeter: randNumber({ max: maxResolutionMeter }),
    maxResolutionMeter: randNumber({ max: maxResolutionMeter }),
    maxAccuracyCE90: randNumber({ min: 0, max: noData }),
    absoluteAccuracyLE90: randNumber({ min: 0, max: noData }),
    accuracySE90: randNumber({ min: 0, max: maxAccuracySE90 }),
    relativeAccuracySE90: randNumber({ min: 0, max: maxRelativeAccuracyLEP90 }),
    visualAccuracy: randNumber({ min: 0, max: maxVisualAccuracy }),
    sensors: [randWord()],
    footprint,
    heightRangeFrom: randNumber(),
    heightRangeTo: randNumber(),
    srsId: randNumber().toString(),
    srsName: randWord(),
    region: [randWord()],
    classification: randWord(),
    productionSystem: randWord(),
    productionSystemVer: randWord(),
    producerName: randWord(),
    minFlightAlt: randNumber(),
    maxFlightAlt: randNumber(),
    geographicArea: randWord(),
    productStatus: RecordStatus.UNPUBLISHED,
    productBoundingBox: undefined,
    productVersion: undefined,
    type: RecordType.RECORD_3D,
    updateDate: undefined,
    productSource: randWord(),
  };
};

export const ingestionPayload = (modelName: string): IngestionPayload => {
  return {
    modelId: createUuid(),
    pathToTileset: modelName,
    tilesetFilename: 'tileset.json',
    metadata: createMetadata(),
  };
};

export const ingestionJobPayload = (payload: IngestionPayload): CreateJobBody => {
  return {
    resourceId: payload.modelId,
    version: '1',
    type: config.get<string>('jobManager.job.type'),
    parameters: createIngestionJobParameters(),
    productType: payload.metadata.productType,
    productName: payload.metadata.productName,
    percentage: 0,
    producerName: payload.metadata.producerName,
    status: OperationStatus.PENDING,
    domain: '3D',
  };
};

export const createIngestionJobParameters = (): IngestionJobParameters => {
  return {
    metadata: createMetadata(),
    modelId: createUuid(),
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
  createTaskForJob: jest.fn(),
  getJob: jest.fn(),
  updateJob: jest.fn(),
};

export const configProviderMock = {
  streamModelPathsToQueueFile: jest.fn(),
};
