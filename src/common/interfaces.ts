import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { ICreateJobBody, OperationStatus } from '@map-colonies/mc-priority-queue';

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

export interface CreatePayload {
  modelId: string;
  pathToTileset: string;
  tilesetFilename: string;
  metadata: Layer3DMetadata;
}

export interface DeletePayload {
  modelId: string;
  modelName: string;
  pathToTileset: string;
}

export interface Provider {
  streamModelPathsToQueueFile: (modelId: string, pathToTileset: string, productName: string) => Promise<number>;
}

export interface CreateJobParameters {
  tilesetFilename: string;
  modelId: string;
  metadata: Layer3DMetadata;
  filesCount: number;
  pathToTileset: string;
}

export interface DeleteJobParameters {
  modelId: string;
  pathToTileset: string;
  filesCount: number;
}

export interface TaskParameters {
  paths: string[];
  modelId: string;
  lastIndexError: number;
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

export interface JobsResponse {
  jobID: string;
  status: OperationStatus;
}

export type CreateJobBody = ICreateJobBody<CreateJobParameters, TaskParameters>;
export type DeleteJobBody = ICreateJobBody<DeleteJobParameters, TaskParameters>;
