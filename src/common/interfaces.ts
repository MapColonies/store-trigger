import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { ICreateJobBody, OperationStatus } from '@map-colonies/mc-priority-queue';
import { StorageClass } from '@aws-sdk/client-s3';
import { S3Provider } from '../providers/s3Provider';
import { NFSProvider } from '../providers/nfsProvider';

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

export interface IngestionPayload {
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

export interface IngestionJobParameters {
  tilesetFilename: string;
  modelId: string;
  metadata: Layer3DMetadata;
  filesCount: number;
  pathToTileset: string;
}

export interface DeleteJobParameters {
  modelId: string;
  pathToTileset: string;
  modelName: string;
  filesCount: number;
}

export interface Tasks {
  ingestion: string;
  delete: string;
}

export interface TaskParameters {
  paths: string[];
  modelId: string;
  lastIndexError: number;
}

export interface ProviderManager {
  ingestion: S3Provider | NFSProvider;
  delete: S3Provider | NFSProvider;
}
export interface S3Config {
  type: "S3"
  accessKeyId: string;
  secretAccessKey: string;
  endpointUrl: string;
  bucket: string;
  region: string;
  tls: boolean;
  forcePathStyle: boolean;
  maxAttempts: number;
  sigVersion: string;
  storageClass?: StorageClass;
}

export interface NFSConfig {
  type: 'NFS'
  pvPath: string;
}

export interface ProvidersConfig {
  ingestion: ProviderConfig;
  delete: ProviderConfig;
}

export type ProviderConfig = S3Config | NFSConfig;

export interface JobsResponse {
  jobID: string;
  status: OperationStatus;
}

export interface JobTypes {
  ingestion: string;
  delete: string;
}

export type CreateJobBody = ICreateJobBody<IngestionJobParameters, TaskParameters>;
export type DeleteJobBody = ICreateJobBody<DeleteJobParameters, TaskParameters>;
