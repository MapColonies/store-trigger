import fs from 'node:fs/promises';
import os from 'node:os';
import LineByLine from 'n-readlines';
import { singleton } from 'tsyringe';

@singleton()
export class QueueFileHandler {
  private readonly queueFilePath: string;
  private readonly linerDictionary: Record<string, LineByLine>;

  public constructor() {
    this.queueFilePath = os.tmpdir();
    this.linerDictionary = {};
  }

  public async createQueueFile(model: string): Promise<void> {
    const filePath = `${this.queueFilePath}/${model}`;
    await fs.writeFile(filePath, '', 'utf8');
    this.linerDictionary[model] = new LineByLine(`${this.queueFilePath}/${model}`);
  }

  public readline(model: string): string | null {
    const line = this.linerDictionary[model].next();

    if (line === false) {
      return null;
    }

    return line.toString('ascii');
  }

  public async writeFileNameToQueueFile(model: string, fileName: string): Promise<void> {
    const filePath = `${this.queueFilePath}/${model}`;
    await fs.appendFile(filePath, fileName + '\n');
  }

  public async checkIfTempFileEmpty(model: string): Promise<boolean> {
    const filePath = `${this.queueFilePath}/${model}`;
    const fileStat = await fs.stat(filePath);
    return fileStat.size === 0;
  }

  public async deleteQueueFile(model: string): Promise<void> {
    const filePath = `${this.queueFilePath}/${model}`;
    await fs.rm(filePath);
    delete this.linerDictionary[model];
  }
}
