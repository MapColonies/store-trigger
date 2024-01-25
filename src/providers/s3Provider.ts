import { CommonPrefix, ListObjectsCommand, ListObjectsRequest, S3Client, S3ClientConfig, S3ServiceException, _Object } from '@aws-sdk/client-s3';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { QueueFileHandler } from '../handlers/queueFileHandler';
import { AppError } from '../common/appError';
import { Provider, S3Config } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@injectable()
export class S3Provider implements Provider {
  private readonly s3: S3Client;
  private filesCount: number;

  public constructor(
    protected readonly s3Config: S3Config,
    @inject(SERVICES.LOGGER) protected readonly logger: Logger,
    protected readonly queueFileHandler: QueueFileHandler
  ) {
    const s3ClientConfig: S3ClientConfig = {
      endpoint: this.s3Config.endpointUrl,
      forcePathStyle: this.s3Config.forcePathStyle,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey,
      },
      region: this.s3Config.region,
      maxAttempts: this.s3Config.maxAttempts,
      apiVersion: this.s3Config.sigVersion,
    };

    this.s3 = new S3Client(s3ClientConfig);
    this.filesCount = 0;
  }

  public async streamModelPathsToQueueFile(modelId: string, pathToTileset: string, modelName: string): Promise<number> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const params: ListObjectsRequest = {
      Bucket: this.s3Config.bucket,
      Delimiter: '/',
      Prefix: pathToTileset + '/',
    };

    await this.listS3Recursively(modelId, params);

    if (await this.queueFileHandler.checkIfTempFileEmpty(modelId)) {
      throw new AppError(httpStatus.NOT_FOUND, `Model ${modelName} doesn't exists in bucket ${this.s3Config.bucket}! Path: ${pathToTileset}`, true);
    }

    this.logger.info({ msg: 'Finished listing the files', filesCount: this.filesCount, modelName, modelId });
    const lastFileCount = this.filesCount;
    this.filesCount = 0;

    return lastFileCount;
  }

  private async listS3Recursively(modelId: string, params: ListObjectsRequest): Promise<void> {
    try {
      const listObject = new ListObjectsCommand(params);
      const data = await this.s3.send(listObject);

      if (data.Contents) {
        await this.writeFileContent(modelId, data.Contents);
      }

      if (data.CommonPrefixes) {
        await this.writeFolderContent(modelId, data.CommonPrefixes);
      }

      if (data.IsTruncated === true) {
        const nextParams: ListObjectsRequest = {
          Bucket: this.s3Config.bucket,
          Delimiter: '/',
          Prefix: data.Prefix,
          Marker: data.NextMarker,
        };
        await this.listS3Recursively(modelId, nextParams);
      }

      this.logger.debug({ msg: `Listed ${this.filesCount} files`, modelId });
    } catch (error) {
      this.logger.error({ msg: 'failed in listing the model', modelId, error });
      this.handleS3Error(this.s3Config.bucket, error);
    }
  }

  private async writeFileContent(modelId: string, contents: _Object[]): Promise<void> {
    for (const content of contents) {
      if (content.Key == undefined) {
        throw new AppError(httpStatus.NO_CONTENT, 'found content without file name', true);
      }
      await this.queueFileHandler.writeFileNameToQueueFile(modelId, content.Key);
      this.filesCount++;
    }
  }

  private async writeFolderContent(modelId: string, CommonPrefixes: CommonPrefix[]): Promise<void> {
    for (const commonPrefix of CommonPrefixes) {
      if (commonPrefix.Prefix != undefined) {
        const nextParams: ListObjectsRequest = {
          Bucket: this.s3Config.bucket,
          Delimiter: '/',
          Prefix: commonPrefix.Prefix,
        };
        await this.listS3Recursively(modelId, nextParams);
      }
    }
  }

  private handleS3Error(s3Bucket: string, error: unknown): never {
    let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    let message = "Didn't throw a S3 exception in file";

    if (error instanceof S3ServiceException) {
      statusCode = error.$metadata.httpStatusCode ?? statusCode;
      message = `${error.name}, message: ${error.message}, bucket: ${s3Bucket}`;
    }

    throw new AppError(statusCode, message, true);
  }
}
