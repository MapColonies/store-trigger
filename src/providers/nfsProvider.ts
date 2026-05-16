import fs from 'node:fs/promises';
import Path from 'node:path';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { QueueFileHandler } from '../handlers/queueFileHandler';
import { SERVICES } from '../common/constants';
import { NFSConfig, LogContext } from '../common/interfaces';
import { AppError } from '../common/appError';
import { BaseProvider } from './baseProvider';

@injectable()
export class NFSProvider extends BaseProvider<NFSConfig> {
  protected override readonly logContext: LogContext;
  private readonly pvPath: string;

  public constructor(
    @inject(SERVICES.LOGGER) protected readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.PROVIDER_CONFIG) protected readonly config: NFSConfig,
    @inject(SERVICES.QUEUE_FILE_HANDLER) protected readonly queueFileHandler: QueueFileHandler
  ) {
    super(logger, tracer, config, queueFileHandler);

    this.logContext = {
      fileName: __filename,
      class: NFSProvider.name,
    };
    this.pvPath = this.config.pvPath;
  }

  @withSpanAsyncV4
  public override async getFile(filePath: string): Promise<Buffer> {
    const logContext = { ...this.logContext, function: this.getFile.name };
    this.logger.debug({
      msg: 'Starting to get file',
      logContext,
      filePath,
    });

    const fullPath = Path.join(this.pvPath, filePath);

    try {
      const data = await fs.readFile(fullPath);
      return data;
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      
      if (error.code === 'ENOENT') {
        throw new AppError(httpStatus.NOT_FOUND, `File ${filePath} not found`, true);
      }
      if (error.code === 'EISDIR') {
        throw new AppError(httpStatus.BAD_REQUEST, `${filePath} is a directory, expected a file`, true);
      }
      
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Error reading file: ${error.message}`, true);
    }
  }
}
