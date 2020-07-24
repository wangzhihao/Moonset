import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';
import {MoonsetConstants as MC} from '../constants';
// eslint-disable-next-line
import * as ir from '../ir';
// eslint-disable-next-line
import * as vi from '../visitor';
import {PluginHost} from '../plugin';
import * as path from 'path';
import {CommonConstants as C, ConfigConstant as CC, Serde} from '@moonset/util';

const c = PluginHost.instance.constructs;

export interface MoonsetProps {

    id: string;

    session: string;

    plugins: string[];

    commands: ir.IR;
}

function network() {
  // https://github.com/aws/aws-cdk/issues/3704
  const vpc = c[MC.VPC] = new ec2.Vpc(c[MC.INFRA_STACK], MC.VPC, {
    maxAzs: 1,
  });
  // eslint-disable-next-line
  cdk.Tag.add(vpc, C.TAG_MOONSET_TYPE, MC.TAG_MOONSET_TYPE_VPC);

  c[MC.VPC_SG] = new ec2.SecurityGroup(c[MC.INFRA_STACK], MC.VPC_SG, {
    vpc: vpc,
  });
  // eslint-disable-next-line
  cdk.Tag.add(<ec2.SecurityGroup>c[MC.VPC_SG], C.TAG_MOONSET_TYPE, MC.TAG_MOONSET_TYPE_VPC_SERCURITY_GROUP);

  // eslint-disable-next-line
  (<ec2.SecurityGroup>c[MC.VPC_SG]).addIngressRule(<ec2.SecurityGroup>c[MC.VPC_SG], ec2.Port.allTraffic());
}

function main() {
  const props = Serde.fromFile<MoonsetProps>(
      path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

  PluginHost.instance.id = props.id;
  PluginHost.instance.session = props.session;
  props.plugins.forEach((plugin) => {
    PluginHost.instance.load(plugin);
  });


  c[MC.CDK_APP] = new cdk.App();

  c[MC.INFRA_STACK] = new cdk.Stack(<cdk.App>c[MC.CDK_APP],
      MC.INFRA_STACK + '-' + props.session, {
        env: {
          account: process.env[CC.WORKING_ACCOUNT],
          region: process.env[CC.WORKING_REGION],
        },
      });
  const logBucket = new s3.Bucket(c[MC.INFRA_STACK], 'logBucket', {});
  // eslint-disable-next-line
cdk.Tag.add(logBucket, C.TAG_MOONSET_TYPE, MC.TAG_MOONSET_TYPE_LOG_S3_BUCEKT);

  network();

  props.commands.cdk.forEach((command) => {
    // TODO Some assumption on all cdk hooks are synchronous are made here.
    // It's very easy to forget and break the assumption. Can we find a way
    // to improve it?
    const hook = PluginHost.instance.hooks[command.op];
    hook.fn.call(hook.thisArg, PluginHost.instance, ...command.args);
  });

  (<cdk.App>c[MC.CDK_APP]).synth();
}

main();
