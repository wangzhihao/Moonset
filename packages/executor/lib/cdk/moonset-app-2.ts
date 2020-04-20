import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import {MoonsetConstants as MC} from '../constants';
// eslint-disable-next-line
import * as ir from '../ir';
// eslint-disable-next-line
import * as vi from '../visitor';
import * as plugin from '../plugin';
import * as path from 'path';
import {Config, ConfigConstant as CC, Serde} from '@moonset/util';

const c = plugin.PluginHost.instance.constructs;

export interface MoonsetProps2 {

    id: string;

    commands: ir.IR2[];
}

function network() {
  // https://github.com/aws/aws-cdk/issues/3704
  c[MC.VPC] = new ec2.Vpc(c[MC.INFRA_STACK], MC.VPC, {
    maxAzs: 1,
  });

  c[MC.VPC_SG] = new ec2.SecurityGroup(c[MC.INFRA_STACK], MC.VPC_SG, {
    vpc: <ec2.Vpc>c[MC.VPC],
  });
  // eslint-disable-next-line
  (<ec2.SecurityGroup>c[MC.VPC_SG]).addIngressRule(<ec2.SecurityGroup>c[MC.VPC_SG], ec2.Port.allTraffic());
}

function stepfunction(props: MoonsetProps2) {
  const commands = plugin.PluginHost.instance.commands;
  let chain = sfn.Chain.start(commands[0]);
  for (let i = 1; i < commands.length; i++) {
    chain = chain.next(commands[i]);
  }
  const emrStepFunction = new sfn.StateMachine(c[MC.SF_STACK], MC.SF, {
    definition: chain,
  });
  cdk.Tag.add(emrStepFunction, MC.TAG_MOONSET_TYPE, MC.TAG_MOONSET_TYPE_SF);
  cdk.Tag.add(emrStepFunction, MC.TAG_MOONSET_ID, props.id);
}

function main() {
  const props = Serde.fromFile<MoonsetProps2>(
      path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

  c[MC.CDK_APP] = new cdk.App();

  c[MC.INFRA_STACK] = new cdk.Stack(<cdk.App>c[MC.CDK_APP], MC.INFRA_STACK, {
    env: {
      account: Config.get(CC.WORKING_ACCOUNT),
      region: Config.get(CC.WORKING_REGION),
    },
  });

  c[MC.SF_STACK] = new cdk.Stack(<cdk.App>c[MC.CDK_APP], MC.SF_STACK, {
    env: {
      account: Config.get(CC.WORKING_ACCOUNT),
      region: Config.get(CC.WORKING_REGION),
    },
  });

  network();

  props.commands.forEach((command) => {
    const fn = plugin.PluginHost.instance.hooks[command.op];
    fn(...command.args);
  });

  stepfunction(props);

  (<cdk.App>c[MC.CDK_APP]).synth();
}

main();
