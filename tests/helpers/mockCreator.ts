import config from 'config';
import { randNumber, randPastDate, randSentence, randUuid, randWord } from '@ngneat/falso';
import { Polygon } from 'geojson';
import { Layer3DMetadata, ProductType, RecordStatus, RecordType } from '@map-colonies/mc-model-types';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import {
  IngestionJobBody,
  DeleteJobParameters,
  DeletePayload,
  IngestionJobParameters as IngestionJobParameters,
  IngestionPayload,
  NFSConfig,
  ProviderConfig,
  ProvidersConfig,
  S3Config,
  DeleteJobBody,
} from '../../src/common/interfaces';

const maxResolutionMeter = 8000;
const noData = 999;
const maxAccuracySE90 = 250;
const maxRelativeAccuracyLEP90 = 100;
const maxVisualAccuracy = 100;

const fakeNFSConfig = (name: string): NFSConfig => {
  return { type: 'NFS', pvPath: `./tests/helpers/${name}` };
};

const fakeS3Config = (bucket: string): S3Config => {
  return {
    type: 'S3',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    endPointUrl: 'http://127.0.0.1:9000',
    bucket,
    region: 'us-east-1',
    forcePathStyle: true,
    tls: false,
    maxAttempts: 3,
    sigVersion: 'v4',
  };
};

const fakeProvidersConfig = (ingestion: string, deleteModel: string): ProvidersConfig => {
  return {
    ingestion: FakeProvider(ingestion, 'ingestion-models'),
    delete: FakeProvider(deleteModel, 'delete-models'),
  };
};

const FakeProvider = (provider: string, name: string): ProviderConfig => {
  switch (provider) {
    case 's3':
      return fakeS3Config(name);
    case 'nfs':
      return fakeNFSConfig(name);
    default:
      throw Error('wrong values');
  }
};

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

export const createIngestionJobParameters = (): IngestionJobParameters => {
  return {
    metadata: createMetadata(),
    modelId: createUuid(),
    tilesetFilename: 'tileset.json',
    filesCount: 0,
    pathToTileset: 'path/to/tileset',
  };
};

export const createDeleteJobParameters = (): DeleteJobParameters => {
  return {
    modelId: createUuid(),
    pathToTileset: 'path/to/tileset',
    filesCount: 0,
    modelName: randWord(),
  };
};

export const createIngestionPayload = (modelName: string): IngestionPayload => {
  return {
    modelId: createUuid(),
    pathToTileset: modelName,
    tilesetFilename: 'tileset.json',
    metadata: createMetadata(),
  };
};

export const createDeletePayload = (modelName: string): DeletePayload => {
  return {
    modelId: createUuid(),
    modelName: modelName,
    pathToTileset: 'path/to/tileset',
  };
};

export const createIngestionJobBody = (payload: IngestionPayload): IngestionJobBody => {
  return {
    resourceId: payload.modelId,
    version: '1',
    type: config.get<string>('jobManager.job.type.ingestion'),
    parameters: createIngestionJobParameters(),
    productType: payload.metadata.productType,
    productName: payload.metadata.productName,
    percentage: 0,
    producerName: payload.metadata.producerName,
    status: OperationStatus.PENDING,
    domain: '3D',
  };
};

export const createDeleteJobBody = (payload: DeletePayload): DeleteJobBody => {
  return {
    resourceId: payload.modelId,
    version: '1',
    type: config.get<string>('jobManager.job.type.delete'),
    parameters: createDeleteJobParameters(),
    percentage: 0,
    status: OperationStatus.PENDING,
    domain: '3D',
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

export const providerManagerMock = {
  ingestion: {
    streamModelPathsToQueueFile: jest.fn(),
  },
  delete: {
    streamModelPathsToQueueFile: jest.fn(),
  },
};

export const mockNFSNFS = fakeProvidersConfig('nfs', 'nfs') as { ingestion: NFSConfig; delete: NFSConfig };
export const mockNFSS3 = fakeProvidersConfig('nfs', 's3') as { ingestion: NFSConfig; delete: S3Config };
export const mockS3NFS = fakeProvidersConfig('s3', 'nfs') as { ingestion: S3Config; delete: NFSConfig };
export const mockS3S3 = fakeProvidersConfig('s3', 's3') as { ingestion: S3Config; delete: S3Config };
