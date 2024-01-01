import * as supertest from 'supertest';
import { DeletePayload, IngestionPayload } from '../../../../src/common/interfaces';

export class JobsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async create(payload: IngestionPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/ingestion').set('Content-Type', 'application/json').send(payload);
  }

  public async delete(payload: DeletePayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/delete').set('Content-Type', 'application/json').send(payload);
  }
}
