import {PluginHost} from '@moonset/executor';
import {MetastoreSync} from './metastore-sync';
import {Platform} from '@moonset/plugin-platform-emr';

export class GlueEmrStepFunctionPlugin {
  private states: any[];

  constructor(private host: PluginHost) {
    this.states = <any[]>(host.platformPlugins[Platform.EMR_STEP_FUNCTION].states!);
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
    this.states.push(this.getState(step));
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
    this.states.push(this.getState(step));
  }

  private getState(step: any) {
    return {
      Name: 'MetastoreSync',
      Parameters: {
        'ClusterId.$': '$.EmrSettings.ClusterId',
        'Step': step,
      },
      Type: 'Task',
      Resource: 'arn:aws:this.states:::elasticmapreduce:addStep.sync',
      ResultPath: null,
    };
  }
}

