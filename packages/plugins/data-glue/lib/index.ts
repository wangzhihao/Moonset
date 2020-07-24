import {GlueEmrSdkPlugin} from './glue-emr-sdk-plugin';
import {GlueEmrStepFunctionPlugin} from './glue-emr-sf-plugin';
import {Platform} from '@moonset/plugin-platform-emr';
import {PluginHost} from '@moonset/executor';

export class GlueDataPlugin {
    public readonly version = '1';
    public readonly plugin = 'data';
    public readonly type = 'glue';

    init() {
      // No CDK resource is required to setup for GlueDataPlugin.
    }

    async import(host: PluginHost, platform: string, data: any) {
      switch (platform) {
        case Platform.EMR_SDK: {
          await new GlueEmrSdkPlugin(host).import(data);
          break;
        }
        case Platform.EMR_STEP_FUNCTION: {
          await new GlueEmrStepFunctionPlugin(host).import(data);
          break;
        }
        default: {
          throw Error(`GlueDataPlugin doesn't support platform type ${platform}.`);
        }
      }
    }
    async export(host: PluginHost, platform: string, data: any) {
      switch (platform) {
        case Platform.EMR_SDK: {
          await new GlueEmrSdkPlugin(host).export(data);
          break;
        }
        case Platform.EMR_STEP_FUNCTION: {
          await new GlueEmrStepFunctionPlugin(host).export(data);
          break;
        }
        default: {
          throw Error(`GlueDataPlugin doesn't support platform type ${platform}.`);
        }
      }
    }
}

export const plugins = [
  new GlueDataPlugin(),
];
