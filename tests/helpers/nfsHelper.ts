import fs from 'fs';
import path from 'path';
import { faker } from '@faker-js/faker';
import { NFSConfig } from '../../src/common/interfaces';

export class NFSHelper {
  public constructor(private readonly config: NFSConfig) {}

  public async createFileOfModel(modelName: string, file: string, data?: string): Promise<string> {
    const subFolders = path.dirname(file);
    const fileName = path.basename(file);
    const dirPath = path.join(this.config.pvPath, modelName, subFolders);
    
    if (!fs.existsSync(dirPath)) {
      await this.createFolder(dirPath);
    }

    const content = data ?? faker.word.words();
    await fs.promises.writeFile(path.join(dirPath, fileName), content);
    return content;
  }

  public async createFolder(path: string): Promise<void> {
    await fs.promises.mkdir(path, { recursive: true });
  }

  public async readFile(path: string): Promise<Buffer> {
    return fs.promises.readFile(`${this.config.pvPath}/${path}`);
  }

  public async cleanNFS(): Promise<void> {
    await fs.promises.rm(this.config.pvPath, { recursive: true });
  }

  public initNFS(): void {
    fs.mkdirSync(this.config.pvPath);
  }
}
