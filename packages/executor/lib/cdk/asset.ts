import * as s3Asset from '@aws-cdk/aws-s3-assets';
import * as cdk from '@aws-cdk/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as execa from 'execa';

export interface HttpAssetProps {
    // The source url.
    readonly url: string
}

export class HttpAsset extends cdk.Construct {
    readonly s3: s3Asset.Asset;

    constructor(scope: cdk.Construct, id: string, props: HttpAssetProps) {
      super(scope, id);

      const tempdir= fs.mkdtempSync(path.join(os.tmpdir(), 'staging'));
      const temppath = path.join(tempdir, 'tmpfile');

      execa.sync('curl', ['-Lo', temppath, props.url]);

      this.s3= new s3Asset.Asset(this, `${id}-HttpAsset`, {
        path: temppath,
      });
    }

    getS3Path(): string {
      return `s3://${this.s3.s3BucketName}/${this.s3.s3ObjectKey}`;
    }
}

export interface StringAssetProps {
    // The source content.
    readonly content: string
}

export class StringAsset extends cdk.Construct {
    readonly s3: s3Asset.Asset;

    constructor(scope: cdk.Construct, id: string, props: StringAssetProps) {
      super(scope, id);

      const tempdir= fs.mkdtempSync(path.join(os.tmpdir(), 'staging'));
      const temppath = path.join(tempdir, 'tmpfile');

      fs.writeFileSync(temppath, props.content);

      this.s3= new s3Asset.Asset(this, `${id}-StringAsset`, {
        path: temppath,
      });
    }

    getS3Path(): string {
      return `s3://${this.s3.s3BucketName}/${this.s3.s3ObjectKey}`;
    }
}

export interface FileAssetProps {
    // The local file path
    readonly path: string
}

export class FileAsset extends cdk.Construct {
    readonly s3: s3Asset.Asset;

    constructor(scope: cdk.Construct, id: string, props: FileAssetProps) {
      super(scope, id);

      this.s3= new s3Asset.Asset(this, `${id}-FileAsset`, {
        path: props.path,
      });
    }

    getS3Path(): string {
      return `s3://${this.s3.s3BucketName}/${this.s3.s3ObjectKey}`;
    }
}
