import * as S3 from 'aws-sdk/clients/s3';
import * as fs from 'fs';
import {v4 as uuid} from 'uuid';
import {CommonConstants as CC} from './constants';
import {ISDK} from './sdk-utils';

/**
 * A SDK based S3 Asset uploader.
 *
 * We don't use CDK way since CloudFormation stacks have limitations (200 by
 * default) and not suitable for high throughput requests. More context can be
 * found here: https://github.com/MoonsetJS/Moonset/issues/73
 */
export class S3AssetUploader {
  /**
     * Setting the S3 bucket and Moonset related information.
     * Every asset will be tagged with its Moonset session and Moonset id.
     */
  constructor(
        private bucket: string,
        private prefix: string,
        private moonsetSession: string,
        private moonsetId: string,
        private sdk: ISDK) {
  }

  /**
     * Upload local file to S3.
     */
  async uploadFile(file: string): Promise<string> {
    return await this.uploadData(fs.createReadStream(file));
  }

  /**
     * Upload string type data to S3.
     */
  async uploadData(body: S3.Types.Body): Promise<string> {
    const s3 = this.sdk.s3();
    const key = `${this.prefix}/${uuid()}`;
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      Tagging: `${CC.MOONSET_SESSION}=${this.moonsetSession}&` +
            `${CC.MOONSET_ID}=${this.moonsetId}`,
    };
    await s3.upload(params).promise();
    return `s3://${this.bucket}/${key}`;
  }
}
