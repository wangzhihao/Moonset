import {PluginHost} from '@moonset/executor';
import {MetastoreSync} from './metastore-sync';
import {Platform} from '@moonset/plugin-platform-emr';
import * as EMR from 'aws-sdk/clients/emr';

export class GlueEmrSdkPlugin {
    private steps: EMR.Types.StepConfigList;

    constructor(private host: PluginHost) {
      this.steps = <EMR.Types.StepConfigList>
          (host.platformPlugins[Platform.EMR_SDK].steps!);
    }

    async import(data: any) {
      const step = await MetastoreSync.getStepConfig(
          this.host,
        data.glue.db!,
        data.glue.table!,
        data.glue.assumeRole,
        data.glue.region,
        'datacatalog',
        data.glue.partition!,
      );
      this.steps.push(step);
    }

    async export(data: any) {
      const step = await MetastoreSync.getStepConfig(
          this.host,
        data.glue.db!,
        data.glue.table!,
        data.glue.assumeRole,
        data.glue.region,
        'hive',
        data.glue.partition!,
      );
      this.steps.push(step);
    }
}

