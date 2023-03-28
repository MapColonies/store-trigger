import config from 'config';
import RandExp from 'randexp';
import { randBetweenDate, randNumber, randPastDate, randUuid, randWord } from '@ngneat/falso';
import { Polygon } from 'geojson';
import { Layer3DMetadata, ProductType, RecordStatus, RecordType } from '@map-colonies/mc-model-types';
import jsLogger from '@map-colonies/js-logger';
import { JobManagerClient, OperationStatus } from '@map-colonies/mc-priority-queue';
import { CreateJobBody, IJobParameters, Payload } from '../../src/common/interfaces';
import { RegisterOptions } from '../../src/containerConfig';
import { SERVICES } from '../../src/common/constants';
import { QueueFileHandler } from '../../src/handlers/queueFileHandler';

const classificationHelper = new RandExp('^[0-9]$').gen();
const listOfRandomWords = ['avi', 'אבי', 'lalalalala', 'וןםפ'];
const maxResolutionMeter = 8000;
const noData = 999;
const maxAccuracySE90 = 250;
const maxRelativeAccuracyLEP90 = 100;
const maxVisualAccuracy = 100;
const minX = 1;
const minY = 2;
const maxX = 3;
const maxY = 4;

export const getBaseRegisterOptions = (): Required<RegisterOptions> => {
  return {
    override: [
      { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      { token: SERVICES.CONFIG, provider: { useValue: config } },
    ],
    useChild: true,
  };
};

export const createUuid = (): string => {
  return randUuid();
};

export const createFootprint = (): Polygon => {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ],
    ],
  };
};

export const createMetadata = (): Layer3DMetadata => {
  const sourceDateStart = randPastDate();
  const sourceDateEnd = randBetweenDate({ from: sourceDateStart, to: new Date() });
  const minResolutionMeter = randNumber({ max: maxResolutionMeter });
  return {
    productId: Math.floor(Math.random() * listOfRandomWords.length).toString(),
    productName: Math.floor(Math.random() * listOfRandomWords.length).toString(),
    productType: ProductType.PHOTO_REALISTIC_3D,
    description: Math.floor(Math.random() * listOfRandomWords.length).toString(),
    creationDate: randPastDate(),
    sourceDateStart: sourceDateStart,
    sourceDateEnd: sourceDateEnd,
    minResolutionMeter: minResolutionMeter,
    maxResolutionMeter: randNumber({ min: minResolutionMeter, max: maxResolutionMeter }),
    maxAccuracyCE90: randNumber({ min: 0, max: noData }),
    absoluteAccuracyLE90: randNumber({ min: 0, max: noData }),
    accuracySE90: randNumber({ min: 0, max: maxAccuracySE90 }),
    relativeAccuracySE90: randNumber({ min: 0, max: maxRelativeAccuracyLEP90 }),
    visualAccuracy: randNumber({ min: 0, max: maxVisualAccuracy }),
    sensors: [randWord()],
    footprint: createFootprint(),
    heightRangeFrom: randNumber(),
    heightRangeTo: randNumber(),
    srsId: randNumber().toString(),
    srsName: randWord(),
    region: [randWord()],
    classification: classificationHelper,
    productionSystem: randWord(),
    productionSystemVer: Math.floor(Math.random() * listOfRandomWords.length).toString(),
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

export const createPayload = (modelName: string): Payload => {
  return {
    modelId: createUuid(),
    modelPath: config.get<string>('NFS.pvPath') + modelName,
    tilesetFilename: 'tileset.json',
    metadata: createMetadata(),
  };
};

export const createJobPayload = (payload: Payload): CreateJobBody => {
  return {
    resourceId: payload.modelId,
    version: '1',
    type: config.get<string>('worker.jobType'),
    parameters: createJobParameters(),
    productType: payload.metadata.productType,
    productName: payload.metadata.productName,
    percentage: 0,
    producerName: payload.metadata.producerName,
    status: OperationStatus.IN_PROGRESS,
    domain: '3D',
  };
};

export const createTaskPayload = (payload: Payload): CreateJobBody => {
  return {
    resourceId: payload.modelId,
    version: '1',
    type: config.get<string>('worker.jobType'),
    parameters: createJobParameters(),
    productType: payload.metadata.productType,
    productName: payload.metadata.productName,
    percentage: 0,
    producerName: payload.metadata.producerName,
    status: OperationStatus.IN_PROGRESS,
    domain: '3D',
  };
};

export const createJobParameters = (): IJobParameters => {
  return {
    metadata: createMetadata(),
    modelId: createUuid(),
    tilesetFilename: 'tileset.json'
  }
}

export const loggerMock = {
  info: jest.fn()
};

export const jobsManagerMock = {
  createJob: jest.fn(),
} as never as JobManagerClient;

export const queueFileHandlerMock = {
  readline: jest.fn(),
  writeFileNameToQueueFile: jest.fn(),
} as never as QueueFileHandler;