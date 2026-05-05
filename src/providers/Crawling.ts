import Path from 'path';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import jsonpath from 'jsonpath';
import { AppError } from '../common/appError';
import { CrawlingConfig, LogContext, Provider } from '../common/interfaces';
import { QueueFileHandler } from '../handlers/queueFileHandler';

export abstract class Crawling<T extends CrawlingConfig> implements Provider { 
  protected readonly logContext: LogContext;
  
  public constructor(
    protected readonly logger: Logger,
    public readonly tracer: Tracer,
    protected readonly config: T,
    protected readonly queueFileHandler: QueueFileHandler
  ) {
    this.logContext = {
      fileName: __filename,
      class: Crawling.name,
    };
  }

  @withSpanAsyncV4
  public async streamModelPathsToQueueFile(modelId: string, pathToTileset: string, modelName: string): Promise<number> {
    const logContext = { ...this.logContext, function: this.streamModelPathsToQueueFile.name };
    
    this.logger.info({
      msg: 'Started streaming model paths to queue file',
      logContext,
      modelName,
      modelId,
      pathToTileset,
    });

    const visitedFiles = new Set<string>();
    const processingQueue: string[] = [pathToTileset];
    let totalFilesAdded = 0;

    while (processingQueue.length > 0) {
      const currentPath = processingQueue.shift()!;

      if (visitedFiles.has(currentPath)) {
        continue;
      }
      visitedFiles.add(currentPath);

      try {
        const buffer = await this.getFile(currentPath);
        
        await this.queueFileHandler.writeFileNameToQueueFile(modelId, currentPath);
        totalFilesAdded++;
 
        if (currentPath.endsWith(this.config.extension)) {
          const nestedPaths = this.extractPathsFromJson(buffer, currentPath);
          
          for (const nestedPath of nestedPaths) {
            if (nestedPath.endsWith(this.config.extension)) {
              processingQueue.push(nestedPath);
            } else if (!visitedFiles.has(nestedPath)) {
              await this.queueFileHandler.writeFileNameToQueueFile(modelId, nestedPath);
              visitedFiles.add(nestedPath);
              totalFilesAdded++;
            }
          }
        }
      } catch (err) {
        if (this.config.ignoreNotFound! && err instanceof AppError && err.status === StatusCodes.NOT_FOUND) {
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
    try {
      const fileContent = buffer.toString();
      const json = JSON.parse(fileContent) as object;
      const results = jsonpath.query(json, this.config.nestedJsonPath) as string[];
      
      return results.map((child) => Path.resolve('/', Path.dirname(currentPath), child));
    } catch (err) {
      this.logger.error({ msg: 'Failed to parse JSON', path: currentPath, err });
      return [];
    }
  }

  public abstract getFile(filePath: string): Promise<Buffer>;
}
