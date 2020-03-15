import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as sfnTasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import {MoonsetConstants as MC, Config as C} from '../constants';
import * as ir from '../ir';
// eslint-disable-next-line
import * as vi from '../visitor';
import * as rc from '~/.moonsetrc';

export class MoonsetApp {
    app: cdk.App;

    constructor(props: MoonsetProps) {
      this.app = new cdk.App({outdir: C.BUILD_TMP_DIR});

      // Infra Stack stores some common resources like roles for reuse purpose.
      const infraStack = new cdk.Stack(this.app, MC.INFRA_STACK, {
        env: {
          account: rc.working_account,
          region: C.WORKING_REGION,
        },
      });

      // Job Stack stores a step fucntion state machine, which will start a EMR
      // cluster when the state machine is executed.
      new MoonsetJobStack(this.app, MC.JOB_STACK, {
        env: {
          account: C.WORKING_ACCOUNT,
          region: C.WORKING_REGION,
        },
        infraStack,
        ...props,
      });
    }
}

export interface MoonsetProps extends cdk.StackProps {

    id: string;

    commands: ir.IR[];

    emrApplications: string[];
}

interface MoonsetJobProps extends MoonsetProps {

    infraStack: cdk.Stack;
}

class MoonsetJobStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: MoonsetJobProps) {
    super(scope, id, props);

    const ec2Role = new iam.Role(props.infraStack, MC.EMR_EC2_ROLE, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    ec2Role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonElasticMapReduceforEC2Role'));

    new iam.CfnInstanceProfile(props.infraStack, MC.EMR_EC2_PROFILE, {
      roles: [ec2Role.roleName],
      instanceProfileName: ec2Role.roleName,
    });

    const emrRole = new iam.Role(props.infraStack, MC.EMR_ROLE, {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
    });

    emrRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonElasticMapReduceRole'));

    const emrSettings = new sfn.Pass(this, 'emrSettings', {
      result: sfn.Result.fromObject({
        ClusterName: `MoonsetEMR-${props.id}`,
      }),
      resultPath: '$.EmrSettings',
    });

    let chain = sfn.Chain.start(emrSettings);

    const emrCreateTask = new sfn.Task(this, 'emrCluster', {
      task: new sfnTasks.EmrCreateCluster({
        visibleToAllUsers: true,
        logUri: 's3://moonset/emr/',
        clusterRole: ec2Role,
        name: sfn.Data.stringAt('$.EmrSettings.ClusterName'),
        serviceRole: emrRole,
        tags: [
          {'key': MC.TAG_MOONSET_TYPE, 'value': MC.TAG_MOONSET_TYPE_EMR},
          {'key': MC.TAG_MOONSET_ID, 'value': props.id},
        ],
        releaseLabel: 'emr-5.29.0',
        applications: props.emrApplications.map((x) =>{
          return {name: x};
        }),
        instances: {
          instanceCount: 3,
          masterInstanceType: 'm5.xlarge',
          slaveInstanceType: 'm5.xlarge',
        },
        integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
      }),
      resultPath: '$.EmrSettings',
    });

    chain = chain.next(emrCreateTask);

    for (const command of props.commands) {
      switch (command.op) {
        case ir.OP.EMRTask:
          const task = (<vi.TaskNode>command.node).task;

          if (task.hive) {
            if (!task.hive.sqlFile) {
              throw Error('The hive sqlFile is required field.');
            }
            const emrTask = new sfn.Task(this, 'emrTask', {
              task: new sfnTasks.EmrAddStep({
                clusterId: sfn.Data.stringAt('$.EmrSettings.ClusterId'),
                name: 'HiveTask',
                jar: 's3://elasticmapreduce/libs/script-runner/script-runner.jar',
                args: [
                  's3://elasticmapreduce/libs/hive/hive-script',
                  '--run-hive-script',
                  '--args',
                  '-f',
                  task.hive.sqlFile,
                ],
                actionOnFailure: sfnTasks.ActionOnFailure.TERMINATE_CLUSTER,
                integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
              }),
              resultPath: sfn.DISCARD,
            });
            chain = chain.next(emrTask);
          }
          break;
        default:
                    // console.log("To be supported, no-op for now.")
      }
    }

    const emrStepFunction = new sfn.StateMachine(this, 'MoonsetStateMachine', {
      definition: chain,
    });
    cdk.Tag.add(emrStepFunction, MC.TAG_MOONSET_TYPE, MC.TAG_MOONSET_TYPE_SF);
  }
}
