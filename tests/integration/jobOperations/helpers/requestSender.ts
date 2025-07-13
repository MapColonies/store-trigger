import * as supertest from 'supertest';
import { DeletePayload, Payload } from '../../../../src/common/interfaces';

export class JobOperationsRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async create(payload: Payload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/JobOperations/ingestion').set('Content-Type', 'application/json').send(payload);
  }

  public async delete(payload: DeletePayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/JobOperations/delete').set('Content-Type', 'application/json').send(payload);
  }
}
