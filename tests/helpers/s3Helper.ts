/* eslint-disable @typescript-eslint/naming-convention */
import {
  CreateBucketCommandInput,
  CreateBucketCommand,
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  PutObjectCommandInput,
  DeleteBucketCommandInput,
  DeleteBucketCommand,
  DeleteObjectCommandInput,
  DeleteObjectCommand,
  ListObjectsRequest,
  ListObjectsCommand,
} from '@aws-sdk/client-s3';
import { inject, injectable } from 'tsyringe';
import { faker } from '@faker-js/faker';
import { SERVICES } from '../../src/common/constants';
import { S3Config } from '../../src/common/interfaces';

@injectable()
export class S3Helper {
  private readonly s3: S3Client;

  public constructor(@inject(SERVICES.PROVIDER_CONFIG) protected readonly s3Config: S3Config) {
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
  }

  public async createBucket(bucket = this.s3Config.bucket): Promise<void> {
    const params: CreateBucketCommandInput = {
      Bucket: bucket,
    };
    const command = new CreateBucketCommand(params);
    await this.s3.send(command);
  }

  public async deleteBucket(bucket = this.s3Config.bucket): Promise<void> {
    const params: DeleteBucketCommandInput = {
      Bucket: bucket,
    };
    const command = new DeleteBucketCommand(params);
    await this.s3.send(command);
  }

  public async createFileOfModel(model: string, file: string): Promise<Buffer> {
    const data = Buffer.from(faker.word.words());
    const params: PutObjectCommandInput = {
      Bucket: this.s3Config.bucket,
      Key: `${model}/${file}`,
      Body: data,
    };
    const command = new PutObjectCommand(params);
    await this.s3.send(command);
    return data;
  }

  public async clearBucket(bucket = this.s3Config.bucket): Promise<void> {
    const params: ListObjectsRequest = {
      Bucket: bucket,
    };
    const listObject = new ListObjectsCommand(params);
    const data = await this.s3.send(listObject);
    if (data.Contents) {
      for (const dataContent of data.Contents) {
        if (dataContent.Key != undefined) {
          await this.deleteObject(dataContent.Key);
        }
      }
    }
  }

  public async deleteObject(key: string): Promise<void> {
    const params: DeleteObjectCommandInput = {
      Bucket: this.s3Config.bucket,
      Key: key,
    };
    const command = new DeleteObjectCommand(params);
    await this.s3.send(command);
  }

  public killS3(): void {
    this.s3.destroy();
  }
}
