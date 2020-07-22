// A factory pattern to fetch SDK module for different accounts e.g. working
// accont and references account.
//
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/index.html

import * as AWS from 'aws-sdk';
// eslint-disable-next-line
import {ConfigurationOptions} from 'aws-sdk/lib/config';
import {CredentialPlugins} from 'aws-cdk/lib/api/aws-auth/credential-plugins';
import {Mode} from 'aws-cdk';
import {logger} from './log';
import {Config, ConfigConstant as CC, CONFIG_PATH} from './config';

export interface ISDK {

    readonly currentRegion: string;

    currentAccount(): Promise<Account>;
    getSession(): Promise<string>;

    s3(): AWS.S3;
    ec2(): AWS.EC2;
    emr(): AWS.EMR;
    iam(): AWS.IAM;
    stepfunctions(): AWS.StepFunctions;
    sts(): AWS.STS;
    cfn(): AWS.CloudFormation;
    tagApi(): AWS.ResourceGroupsTaggingAPI;
}

export class SDK implements ISDK {
    public readonly currentRegion: string;

    private readonly config: ConfigurationOptions;

    /**
     * Default retry options for SDK clients.
     */
    private readonly retryOptions = {
      maxRetries: 6,
      retryDelayOptions: {base: 300},
    };

    constructor(private readonly credentials: AWS.Credentials, region: string) {
      this.config = {
        ...this.retryOptions,
        credentials,
        region,
      };
      this.currentRegion = region;
    }

    public s3(): AWS.S3 {
      return new AWS.S3(this.config);
    }

    public ec2(): AWS.EC2 {
      return new AWS.EC2(this.config);
    }

    public emr(): AWS.EMR {
      return new AWS.EMR(this.config);
    }

    public iam(): AWS.IAM {
      return new AWS.IAM(this.config);
    }

    public stepfunctions(): AWS.StepFunctions {
      return new AWS.StepFunctions(this.config);
    }

    public cfn(): AWS.CloudFormation {
      return new AWS.CloudFormation(this.config);
    }

    public sts(): AWS.STS {
      return new AWS.STS(this.config);
    }

    public tagApi(): AWS.ResourceGroupsTaggingAPI {
      return new AWS.ResourceGroupsTaggingAPI(this.config);
    }

    public async currentAccount(): Promise<Account> {
      logger.info('Looking up default account ID from STS');
      const result = await new AWS.STS(this.config)
          .getCallerIdentity().promise();
      const accountId = result.Account;
      const partition = result.Arn!.split(':')[1];
      if (!accountId) {
        throw new Error('STS didn\'t return an account ID');
      }
      logger.info('Default account ID:', accountId);
      return {accountId, partition};
    }


    // It might be a user or a role.
    public async getSession() {
      const sts = this.sts();
      const currentUser = await sts.getCallerIdentity().promise();
      const session = currentUser.Arn!
          .split('/')
          .slice(-1)[0]
          .replace(/[^A-Za-z0-9-]/g, '-');
      logger.info(`Current user is ${JSON.stringify(currentUser)},` +
        ` the extract session id is ${session}.`);
      return session;
    }
}


export class SDKProvider {
  public static async forWorkingAccount(): Promise<ISDK> {
    if (!process.env[CC.WORKING_ACCOUNT]) {
      throw new Error('The working account is not specified.');
    }
    let credentials: AWS.Credentials | undefined;
    const region = process.env[CC.WORKING_REGION];

    if (Config.get(CC.WORKING_ACCESS_KEY) &&
        Config.get(CC.WORKING_SECRET_KEY)) {
      // Check config first.
      logger.info(`Fetch Working account credentials from ${CONFIG_PATH}`);
      credentials = new AWS.Credentials(
          Config.get(CC.WORKING_ACCESS_KEY)!,
          Config.get(CC.WORKING_SECRET_KEY)!,
      );
    } else {
      // Load from CDK Credentials plugins.
      credentials = await new CredentialPlugins().fetchCredentialsFor(
            process.env[CC.WORKING_ACCOUNT]!,
            Mode.ForWriting,
      );
    }
    if (!credentials) {
      throw new Error(`No credentials for account ${CC.WORKING_ACCOUNT}`);
    }
    if (!region) {
      throw new Error(`The working account region is not specified.`);
    }
    return new SDK(credentials, region);
  }
}

/**
 * An AWS account
 *
 * An AWS account always exists in only one partition. Usually we don't care
 * about the partition, but when we need to form ARNs we do.
 */
export interface Account {
    /**
     * The account number
     */
    readonly accountId: string;

    /**
     * The partition ('aws' or 'aws-cn' or otherwise)
     */
    readonly partition: string;
}

