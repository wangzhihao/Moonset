import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import {MoonsetConstants as MC} from '../constants';
// eslint-disable-next-line
import * as ir from '../ir';
// eslint-disable-next-line
import * as vi from '../visitor';
import {PluginHost} from '../plugin';
import * as path from 'path';
import {ConfigConstant as CC, Serde} from '@moonset/util';

const c = PluginHost.instance.constructs;

export interface MoonsetProps {

    id: string;

    userName: string;

    plugins: string[];

    commands: ir.IR[];
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

function stepfunction(props: MoonsetProps) {
  const commands = PluginHost.instance.commands;
  let chain = sfn.Chain.start(commands[0]);
  for (let i = 1; i < commands.length; i++) {
    chain = chain.next(commands[i]);
  }
  const emrStepFunction = new sfn.StateMachine(c[MC.SF_STACK],
      MC.SF + '-' + props.userName, {
        definition: chain,
      });
  cdk.Tag.add(emrStepFunction, MC.TAG_MOONSET_TYPE, MC.TAG_MOONSET_TYPE_SF);
  cdk.Tag.add(emrStepFunction, MC.TAG_MOONSET_ID, props.id);
}

function main() {
  const props = Serde.fromFile<MoonsetProps>(
      path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

  PluginHost.instance.id = props.id;
  PluginHost.instance.userName = props.userName;
  props.plugins.forEach((plugin) => {
    PluginHost.instance.load(plugin);
  });


  c[MC.CDK_APP] = new cdk.App();

  c[MC.INFRA_STACK] = new cdk.Stack(<cdk.App>c[MC.CDK_APP],
      MC.INFRA_STACK + '-' + props.userName, {
        env: {
          account: process.env[CC.WORKING_ACCOUNT],
          region: process.env[CC.WORKING_REGION],
        },
      });

  c[MC.SF_STACK] = new cdk.Stack(<cdk.App>c[MC.CDK_APP],
      MC.SF_STACK + '-' + props.userName, {
        env: {
          account: process.env[CC.WORKING_ACCOUNT],
          region: process.env[CC.WORKING_REGION],
        },
      });

  network();

  props.commands.forEach((command) => {
    const fn = PluginHost.instance.hooks[command.op];
    fn(PluginHost.instance, ...command.args);
  });

  stepfunction(props);

  (<cdk.App>c[MC.CDK_APP]).synth();
}

main();
