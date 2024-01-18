/* eslint-disable @typescript-eslint/naming-convention */
import { randSentence } from '@ngneat/falso';
import {
  CreateBucketCommand,
  CreateBucketCommandInput,
  DeleteBucketCommandInput,
  DeleteObjectCommandInput,
  PutObjectCommandInput,
  DeleteBucketCommand,
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsRequest,
  ListObjectsCommand,
  S3ClientConfigType,
  GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { S3Config } from '../../src/common/interfaces';

export class S3Helper {
  private readonly s3: S3Client;

  public constructor(private readonly config: S3Config) {
    const s3ClientConfig: S3ClientConfigType = {
      endpoint: config.endpointUrl,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      region: config.region,
      maxAttempts: config.maxAttempts,
      forcePathStyle: config.forcePathStyle,
    };
    this.s3 = new S3Client(s3ClientConfig);
  }

  public async initialize(): Promise<void> {
    await this.createBucket(this.config.bucket);
  }

  public async terminate(): Promise<void> {
    await this.clearBucket(this.config.bucket);
    await this.deleteBucket(this.config.bucket);
  }

  public async createBucket(bucket: string): Promise<void> {
    const params: CreateBucketCommandInput = {
      Bucket: bucket,
    };
    await this.s3.send(new CreateBucketCommand(params));
  }

  public async deleteBucket(bucket = this.config.bucket): Promise<void> {
    const params: DeleteBucketCommandInput = {
      Bucket: bucket,
    };
    await this.s3.send(new DeleteBucketCommand(params));
  }

  public async createFileOfModel(model: string, file: string): Promise<Buffer> {
    const data = Buffer.from(randSentence());
    const params: PutObjectCommandInput = {
      Bucket: this.config.bucket,
      Key: `${model}/${file}`,
      Body: data,
    };
    await this.s3.send(new PutObjectCommand(params));
    return data;
  }

  public async clearBucket(bucket = this.config.bucket): Promise<void> {
    const params: ListObjectsRequest = {
      Bucket: bucket,
    };
    const listObject = new ListObjectsCommand(params);
    const data = await this.s3.send(listObject);
    if (data.Contents) {
      for (const dataContent of data.Contents) {
        if (dataContent.Key != undefined) {
          await this.deleteObject(bucket, dataContent.Key);
        }
      }
    }
  }

  public async deleteObject(bucket: string, key: string): Promise<void> {
    const params: DeleteObjectCommandInput = {
      Bucket: bucket,
      Key: key,
    };
    const command = new DeleteObjectCommand(params);
    await this.s3.send(command);
  }

  public async readFile(bucket: string, key: string): Promise<Buffer | undefined> {
    const params: GetObjectCommandInput = {
      Bucket: bucket,
      Key: key,
    };
    const response = await this.s3.send(new GetObjectCommand(params));
    return response.Body?.transformToString() as unknown as Buffer;
  }
}
