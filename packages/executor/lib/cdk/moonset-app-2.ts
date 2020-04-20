import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as sfnTasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import {MoonsetConstants as MC} from '../constants';
import {MetastoreSyncConstruct} from './metastore-sync';
import * as ir from '../ir';
// eslint-disable-next-line
import * as vi from '../visitor';
import {StringAsset, FileAsset} from './asset';
import * as path from 'path';
import {Config, ConfigConstant as CC, Serde} from '@moonset/util';

export class MoonsetApp2 {
    app: cdk.App;

    constructor() {
      const props = Serde.fromFile<MoonsetProps2>(
          path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

      this.app = new cdk.App();

      // Job Stack stores a step fucntion state machine, which will start a EMR
      // cluster when the state machine is executed.
      new MoonsetJobStack2(this.app, MC.JOB_STACK, {
        env: {
          account: Config.get(CC.WORKING_ACCOUNT),
          region: Config.get(CC.WORKING_REGION),
        },
        ...props,
      });
    }
}

export interface MoonsetProps2 extends cdk.StackProps {

    id: string;

    commands: ir.IR2[];
}

class MoonsetJobStack2 extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: MoonsetProps2) {
    super(scope, id, props);

    const chainable = props.commands.map((command) => this.execute(command));

    let chain = sfn.Chain.start(chainable[0]);
    for (let i = 1; i < chainable.length; i++) {
        chain = chain.next(chainable[i]);
    }

    const emrStepFunction = new sfn.StateMachine(this, 'MoonsetStateMachine', {
      definition: chain,
    });
  }
  execute(command : ir.IR2): sfn.IChainable {
    const emrSettings = new sfn.Pass(this, 'emrSettings', {
      result: sfn.Result.fromObject({
        ClusterName: `MoonsetEMR-${command}`,
      }),
      resultPath: '$.EmrSettings',
    });
    return emrSettings;
  }
}

new MoonsetApp2().app.synth();
