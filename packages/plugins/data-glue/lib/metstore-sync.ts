import * as s3Asset from '@aws-cdk/aws-s3-assets';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as sfnTasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as cdk from '@aws-cdk/core';
import {MoonsetConstants as MC} from '@moonset/executor';
import * as path from 'path';

export interface MetastoreSyncProps {
    db: string,
    table: string,
    assumeRole?: string,
    region?: string,
    source: string,
    partition?: {[k: string]: string}
}


export class MetastoreSyncConstruct extends cdk.Construct {
    readonly task: sfn.Task;

    constructor(scope: cdk.Construct, id: string, props: MetastoreSyncProps) {
      super(scope, id);
      const asset = new s3Asset.Asset(this, `${id}-metastoreSync-script`, {
        path: path.resolve(__dirname, '..', 'script', 'metastore-sync.sh'),
      });

      const region = props.region ? props.region : 'us-east-1';

      const args = [];
      args.push(
          `s3://${asset.s3BucketName}/${asset.s3ObjectKey}`,
          '--database',
          props.db,
          '--table',
          props.table,
          '--source',
          props.source,
          '--region',
          region,
      );

      if (props.assumeRole) {
        args.push('--assume_role', props.assumeRole);
      }

      if (props.partition) {
        const partition = props.partition;
        args.push(
            '--partition',
            Object.keys(partition).map(function(key) {
              return key +'=' + partition[key];
            }).join(';'),
        );
      }
      this.task = new sfn.Task(this, `${id}-sync-${props.db}.${props.table}`, {
        task: new sfnTasks.EmrAddStep({
          clusterId: sfn.Data.stringAt('$.EmrSettings.ClusterId'),
          name: 'MetastoreSyncTask',
          jar: MC.SCRIPT_RUNNER,
          args: args,
          actionOnFailure: sfnTasks.ActionOnFailure.TERMINATE_CLUSTER,
          integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
        }),
        resultPath: sfn.DISCARD,
      });
    }
}
