import Path from 'node:path';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import jsonpath from 'jsonpath';
import { AppError } from '../common/appError';
import { BaseProviderConfig, LogContext, Provider } from '../common/interfaces';
import { QueueFileHandler } from '../handlers/queueFileHandler';

export abstract class BaseProvider<T extends BaseProviderConfig> implements Provider {
  protected readonly logContext: LogContext;
  private readonly crawlingExtension: string;

  public constructor(
    protected readonly logger: Logger,
    public readonly tracer: Tracer,
    protected readonly config: T,
    protected readonly queueFileHandler: QueueFileHandler
  ) {
    this.logContext = {
      fileName: __filename,
      class: BaseProvider.name,
    };

    const extension = this.config.extension;
    this.crawlingExtension = extension.startsWith('.') ? extension : `.${extension}`;
  }

  @withSpanAsyncV4
  public async streamModelPathsToQueueFile(modelId: string, pathToTileset: string, tilesetFilename: string, modelName: string): Promise<number> {
    const logContext = { ...this.logContext, function: this.streamModelPathsToQueueFile.name };

    let fullPath: string = Path.join(pathToTileset, tilesetFilename);
    fullPath = fullPath.replace(/\\/g, '/').replace(/^\//, '');

    this.logger.info({
      msg: 'Started streaming model paths to queue file',
      logContext,
      modelName,
      modelId,
      pathToTileset: fullPath,
    });

    const visitedFiles = new Set<string>();
    const processingQueue: string[] = [fullPath];
    let totalFilesAdded = 0;

    while (processingQueue.length > 0) {
      const currentPath = processingQueue.shift();

      if (currentPath === undefined) {
        this.logger.debug({
          msg: 'Skipping undefined currentPath',
          logContext,
          modelId,
          path: currentPath,
        });
        continue;
      }

      if (visitedFiles.has(currentPath)) {
        this.logger.debug({
          msg: 'Skipping already visited file',
          logContext,
          modelId,
          path: currentPath,
        });
        continue;
      }

      visitedFiles.add(currentPath);

      this.logger.debug({
        msg: 'Processing model file',
        logContext,
        modelId,
        path: currentPath,
        queueRemaining: processingQueue.length,
      });

      try {
        const buffer = await this.getFile(currentPath);

        await this.queueFileHandler.writeFileNameToQueueFile(modelId, currentPath);
        totalFilesAdded++;

        this.logger.debug({
          msg: 'Added file to queue file',
          logContext,
          modelId,
          path: currentPath,
          totalFilesAdded,
        });

        if (currentPath.endsWith(this.crawlingExtension)) {
          const nestedPaths = this.extractPathsFromJson(buffer, currentPath);

          for (const nestedPath of nestedPaths) {
            if (visitedFiles.has(nestedPath)) {
              this.logger.debug({
                msg: 'Skipping already visited nested path',
                logContext,
                modelId,
                path: nestedPath,
                sourcePath: currentPath,
              });
              continue;
            }

            if (nestedPath.endsWith(this.crawlingExtension)) {
              processingQueue.push(nestedPath);
              this.logger.debug({
                msg: 'Queued nested JSON file for processing',
                logContext,
                modelId,
                path: nestedPath,
                sourcePath: currentPath,
                queueSize: processingQueue.length,
              });
            } else {
              await this.queueFileHandler.writeFileNameToQueueFile(modelId, nestedPath);
              visitedFiles.add(nestedPath);
              totalFilesAdded++;
              this.logger.debug({
                msg: 'Added nested file to queue file',
                logContext,
                modelId,
                path: nestedPath,
                sourcePath: currentPath,
                totalFilesAdded,
              });
            }
          }
        }
      } catch (err) {
        if (this.config.ignoreNotFound && err instanceof AppError && err.status === StatusCodes.NOT_FOUND) {
          this.logger.warn({ msg: 'File not found, skipping...', logContext, path: currentPath, modelName });
          continue;
        }

        this.logger.error({
          msg: 'Failed to stream model paths to queue file',
          logContext,
          modelName,
          modelId,
          path: currentPath,
          err,
        });

        throw err;
      }
    }

    this.logger.info({
      msg: 'Finished streaming model paths to queue file',
      logContext,
      modelName,
      modelId,
      totalFilesAdded,
    });

    return totalFilesAdded;
  }

  private extractPathsFromJson(buffer: Buffer, currentPath: string): string[] {
    const logContext = { ...this.logContext, function: this.extractPathsFromJson.name };

    this.logger.debug({
      msg: 'Extracting paths from JSON content',
      logContext: logContext,
      path: currentPath,
      nestedJsonPath: this.config.nestedJsonPath,
    });

    try {
      const fileContent = buffer.toString();
      const json = JSON.parse(fileContent) as object;
      const nestedJsonPath = this.config.nestedJsonPath;
      const results = jsonpath.query(json, nestedJsonPath) as string[];

      this.logger.debug({
        msg: 'Found raw nested path references in JSON',
        logContext: logContext,
        path: currentPath,
        rawPathsCount: results.length,
      });

      const dirname = Path.dirname(currentPath);

      const resolvedPaths = results.map((child) => {
        const joinedPath = dirname === '.' ? child : Path.join(dirname, child);
        return joinedPath.replace(/\\/g, '/').replace(/^\//, '');
      });

      this.logger.debug({
        msg: 'Resolved nested paths relative to current file',
        logContext: logContext,
        path: currentPath,
        resolvedPathsCount: resolvedPaths.length,
      });

      return resolvedPaths;
    } catch (err) {
      this.logger.error({ msg: 'Failed to parse JSON', path: currentPath, err });
      return [];
    }
  }

  public abstract getFile(filePath: string): Promise<Buffer>;
}
