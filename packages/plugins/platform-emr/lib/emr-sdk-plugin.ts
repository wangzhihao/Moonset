import * as cdk from '@aws-cdk/core';
import {CDKResourceReader, logger} from '@moonset/util';
import {ISDK, SDKProvider} from '@moonset/util';
import {PluginHost, MoonsetConstants as MC} from '@moonset/executor';
import * as EMR from 'aws-sdk/clients/emr';
import {RequestGenerator} from './request-generator';
import {Platform, EMRConstants as EC} from './constants';
import {CDKResourceManager} from './cdk-resource-manager';


export class EmrSdkPlatformPlugin {
    public readonly version = '1';
    public readonly plugin = 'platform';
    public readonly type = Platform.EMR_SDK;
    public steps: EMR.Types.StepConfigList = [];

    constructor() {
    }

    init(host: PluginHost) {
      new CDKResourceManager(host, Platform.EMR_SDK).setup();
    }

    async task(host: PluginHost, type: string, task: any) {
      const sdk = await SDKProvider.forWorkingAccount();
      const resources = new CDKResourceReader(host.session, sdk);
      const generator = new RequestGenerator(host, Platform.EMR_SDK, resources);
      this.steps.push(await generator.getStepConfig(type, task));
    }

    async run(host: PluginHost) {
      const sdk = await SDKProvider.forWorkingAccount();
      // For now we only have working account's cdk resources.
      const resources = new CDKResourceReader(host.session, sdk);
      const generator = new RequestGenerator(host, Platform.EMR_SDK, resources);

      // EMR runs in working account.
      const emr = sdk.emr();
      const params = {
        Steps: this.steps,
        ...(await generator.getRunJobFlowInput()),
      };
      logger.info(`EMR will be created with params: ${JSON.stringify(params)}.`);
      const c = host.constructs;
      logger.info(await resources.findRoleCDK(c[EC.EMR_STACK], c[EC.EMR_EC2_ROLE]));
      //await emr.runJobFlow(params).promise();
    }
};

