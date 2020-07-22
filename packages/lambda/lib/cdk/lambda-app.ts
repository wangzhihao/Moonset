import * as cdk from '@aws-cdk/core';
import {MoonsetConstants as MC} from '@moonset/executor';
import * as path from 'path';
import {CommonConstants as C, ConfigConstant as CC, Serde} from '@moonset/util';
import * as lambda from '@aws-cdk/aws-lambda';

const DEPLOY_STACK = 'DeployStack';
const MOONSET_LAMBDA = 'MoonsetLambda';

export interface DeploymentProps {
    session: string;
}

function main() {
  const props = Serde.fromFile<DeploymentProps>(
      path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

  const app = new cdk.App();

  const stack = new cdk.Stack(app,
      DEPLOY_STACK + '-' + props.session, {
        env: {
          account: process.env[CC.WORKING_ACCOUNT],
          region: process.env[CC.WORKING_REGION],
        },
      });

  const fn = new lambda.Function(stack, MOONSET_LAMBDA, {
    runtime: lambda.Runtime.NODEJS_12_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset(
        path.resolve(__dirname, '..', 'lambda', 'index.js'),
    ),
  });

  app.synth();
}

main();
