import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { ICreateJobBody, IJobResponse, OperationStatus } from '@map-colonies/mc-priority-queue';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export interface Payload {
  modelId: string;
  pathToTileset: string;
  tilesetFilename: string;
  metadata: Layer3DMetadata;
}

export interface DeletePayload {
  modelId: string; // internalId in job (catalogId)
  productId: string; // resourceId in job
  productVersion: number;
  productName: string;
  productType: string;
  producerName: string;
}

// ToDo: merge this class with the identical class in file-syncer
export interface Provider {
  streamModelPathsToQueueFile: (modelId: string, pathToTileset: string, productName: string) => Promise<number>;
  getFile: (filePath: string) => Promise<Buffer>;
}

export interface IngestionJobParameters {
  tilesetFilename: string;
  modelId: string;
  metadata: Layer3DMetadata;
  filesCount: number;
  pathToTileset: string;
}

export interface IngestionTaskParameters {
  paths: string[];
  modelId: string;
  lastIndexError: number;
}

export interface DeleteJobParameters {
  modelId: string;
}

export interface DeleteTaskParameters {
  modelId: string;
  blockDuplication?: boolean;
}

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpointUrl: string;
  bucket: string;
  region: string;
  sslEnabled: boolean;
  forcePathStyle: boolean;
}

export interface NFSConfig {
  pvPath: string;
}

export type ProviderConfig = S3Config | NFSConfig;

export interface JobOperationResponse {
  jobId: string;
  status: OperationStatus;
}

export interface JobStatusResponse {
  percentage: number;
  status: OperationStatus;
}

export interface JobStatusParams {
  jobId: string;
}

export interface LogContext {
  fileName: string;
  class: string;
  function?: string;
}

export type JobResponse = IJobResponse<IngestionJobParameters, IngestionTaskParameters>;
export type CreateIngestionJobBody = ICreateJobBody<IngestionJobParameters, IngestionTaskParameters>;
export type CreatDeleteJobBody = ICreateJobBody<DeleteJobParameters, DeleteTaskParameters>;
