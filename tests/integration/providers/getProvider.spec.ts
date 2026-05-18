import config from 'config';
import { container } from 'tsyringe';
import { AppError } from '../../../src/common/appError';
import { getProvider, getProviderConfig } from '../../../src/providers/getProvider';

describe('getProviderConfig tests', () => {
  it('should return the NFS config merged with crawling config when the provider is NFS', () => {
    const provider = 'NFS';
    /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
    const nfsConfig = config.get('NFS') as Record<string, unknown>;
    const crawlingConfig = config.get('crawling') as Record<string, unknown>;
    const expected = { ...nfsConfig, ...crawlingConfig };

    const response = getProviderConfig(provider);

    expect(response).toStrictEqual(expected);
  });

  it('should return the S3 config merged with crawling config when the provider is S3', () => {
    const provider = 'S3';
    const s3Config = config.get('S3') as Record<string, unknown>;
    const crawlingConfig = config.get('crawling') as Record<string, unknown>;
    /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */
    const expected = { ...s3Config, ...crawlingConfig };

    const response = getProviderConfig(provider);

    expect(response).toStrictEqual(expected);
  });

  it(`should throw an error when the provider can't be found on config`, () => {
    const provider = 'bla';

    const response = () => getProviderConfig(provider);

    expect(response).toThrow(AppError);
  });
});

describe('getProvider tests', () => {
  it('should throw an error when the provider is nor S3 or NFS', () => {
    const provider = 'bla';

    const response = () => getProvider(provider, container);

    expect(response).toThrow(AppError);
  });
});
