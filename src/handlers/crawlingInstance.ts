import Path from 'path';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import jsonpath from 'jsonpath';
import { AppError } from '../common/appError';
import { CrawlingConfig, LogContext, Provider } from '../common/interfaces';
import { QueueFileHandler } from './queueFileHandler';

export class CrawlingInstance implements Provider {
  private readonly logContext: LogContext;

  public constructor(
    private readonly logger: Logger,
    public readonly tracer: Tracer,
    public readonly config: CrawlingConfig,
    private readonly underlying: Provider,
    private readonly queueFileHandler: QueueFileHandler
  ) {
    this.logContext = {
      fileName: __filename,
      class: CrawlingInstance.name,
    };
    if (this.underlying instanceof CrawlingInstance) {
      throw new AppError(StatusCodes.BAD_REQUEST, `Invalid config in provider: Do not nest crawling providers.`, false);
    }
  }

  @withSpanAsyncV4
  public async getFile(filePath: string): Promise<Buffer> {
    return this.underlying.getFile(filePath);
  }

  @withSpanAsyncV4
  public async streamModelPathsToQueueFile(modelId: string, path: string, modelName: string): Promise<number> {
    const logContext = { ...this.logContext, function: this.streamModelPathsToQueueFile.name };
    let buffer: Buffer;
    try {
      buffer = await this.underlying.getFile(path);
    } catch (err) {
      if (this.config.ignoreNotFound! && err instanceof AppError && err.status === StatusCodes.NOT_FOUND) {
        this.logger.warn({
          msg: 'Found a non-existing file, but instructed to ignore. Skipping...',
          logContext,
          path,
          modelId,
          modelName,
        });
        return 0;
      } else {
        throw err;
      }
    }
    const fileContent = buffer.toString();
    let file: object = {};
    try {
      file = JSON.parse(fileContent) as object;
    } catch (err) {
      if (err instanceof SyntaxError) {
        this.logger.error({
          msg: 'File is not a valid JSON',
          logContext,
          path,
          modelId,
          modelName,
        });
        throw new AppError(StatusCodes.NOT_ACCEPTABLE, 'File is not a valid JSON', false);
      } else {
        throw err;
      }
    }

    const nestedFiles = jsonpath.query(file, this.config.nestedJsonPath).map((child: string) => Path.resolve('/', Path.dirname(path), child));
    const leafs = nestedFiles.filter((path) => !path.endsWith(this.config.extension));
    const addedFilePromises = [...leafs, path].map(async (path) => {
      await this.queueFileHandler.writeFileNameToQueueFile(modelId, path);
      return 1;
    });

    const children = nestedFiles.filter((path) => path.endsWith(this.config.extension));
    const countPromises = children.map(async (path) => this.streamModelPathsToQueueFile(modelId, path, modelName));
    const counts = await Promise.all([...countPromises, ...addedFilePromises]);
    return counts.reduce((a, b) => a + b);
  }
}
