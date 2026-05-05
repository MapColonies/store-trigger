import {
  GetObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { QueueFileHandler } from '../handlers/queueFileHandler';
import { SERVICES } from '../common/constants';
import { LogContext, S3Config } from '../common/interfaces';
import { Crawling } from './Crawling';

@injectable()
export class S3Provider extends Crawling<S3Config> {
  protected override readonly logContext: LogContext;
  private readonly s3: S3Client;

  public constructor(
    @inject(SERVICES.LOGGER) protected readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.PROVIDER_CONFIG) protected readonly s3Config: S3Config,
    @inject(SERVICES.QUEUE_FILE_HANDLER) protected readonly queueFileHandler: QueueFileHandler
  ) {
    super(logger, tracer, s3Config, queueFileHandler);

    const s3ClientConfig: S3ClientConfig = {
      endpoint: this.s3Config.endpointUrl,
      forcePathStyle: this.s3Config.forcePathStyle,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey,
      },
      region: this.s3Config.region,
    };

    this.s3 = new S3Client(s3ClientConfig);

    this.logContext = {
      fileName: __filename,
      class: S3Provider.name,
    };
  }

  @withSpanAsyncV4
  public override async getFile(filePath: string): Promise<Buffer> {
    const logContext = { ...this.logContext, function: this.getFile.name };
    this.logger.debug({
      msg: 'Starting to get file',
      logContext,
      filePath,
    });

    const getObjectCommand = new GetObjectCommand({
      /* eslint-disable @typescript-eslint/naming-convention */
      Bucket: this.s3Config.bucket,
      Key: filePath,
      /* eslint-disable @typescript-eslint/naming-convention */
    });

    try {
      const response = await this.s3.send(getObjectCommand);
      const responseArray = await response.Body?.transformToByteArray();
      return Buffer.from(responseArray as Uint8Array);
    } catch (err) {
      this.logger.error({
        msg: 'an error occurred during getting file',
        err,
        endpoint: this.s3Config.endpointUrl,
        bucketName: this.s3Config.bucket,
        key: filePath,
      });
      const s3Error = err as Error;
      throw new Error(`an error occurred during the get key ${filePath} on bucket ${this.s3Config.bucket}, ${s3Error.message}`);
    }
  }
}
