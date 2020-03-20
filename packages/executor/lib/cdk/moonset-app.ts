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
import * as path from 'path';
import {Config, ConfigConstant as CC, Serde} from '@moonset/util';

export class MoonsetApp {
    app: cdk.App;

    constructor() {
      const props = Serde.fromFile<MoonsetProps>(
          path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

      this.app = new cdk.App();

      // Infra Stack stores some common resources like roles for reuse purpose.
      const infraStack = new cdk.Stack(this.app, MC.INFRA_STACK, {
        env: {
          account: Config.get(CC.WORKING_ACCOUNT),
          region: Config.get(CC.WORKING_REGION),
        },
      });

      // Job Stack stores a step fucntion state machine, which will start a EMR
      // cluster when the state machine is executed.
      new MoonsetJobStack(this.app, MC.JOB_STACK, {
        env: {
          account: Config.get(CC.WORKING_ACCOUNT),
          region: Config.get(CC.WORKING_REGION),
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

    const vpc = new ec2.Vpc(props.infraStack, 'MoonsetVPC', {
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'Public',
        },
        {
          subnetType: ec2.SubnetType.PRIVATE,
          name: 'Private',
        },
      ],
    });

    const sg = new ec2.SecurityGroup(props.infraStack, 'MoonsetSG', {vpc});
    sg.addIngressRule(sg, ec2.Port.allTraffic());

    new ec2.BastionHostLinux(
        props.infraStack, 'MoonsetBastion', {
          vpc,
          securityGroup: sg,
        });

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
        logUri: Config.get(CC.EMR_LOG),
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
          ec2KeyName: Config.get(CC.EMR_KEY_PAIR),
          ec2SubnetId: vpc.privateSubnets[0].subnetId,
          additionalMasterSecurityGroups: [sg.securityGroupId],
        },
        integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
      }),
      resultPath: '$.EmrSettings',
    });

    chain = chain.next(emrCreateTask);

    for (let i = 0; i < props.commands.length; i++) {
      const command = props.commands[i];
      switch (command.op) {
        case ir.OP.EMRTask: {
          const task = (<vi.TaskNode>command.node).task;

          if (task.hive) {
            if (!task.hive.sqlFile) {
              throw Error('The hive sqlFile is required field.');
            }
            const emrTask = new sfn.Task(this, 'emrTask', {
              task: new sfnTasks.EmrAddStep({
                clusterId: sfn.Data.stringAt('$.EmrSettings.ClusterId'),
                name: 'HiveTask',
                jar: MC.SCRIPT_RUNNER,
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
        }
        case ir.OP.InputMetastoreSync: {
          const dataset = (<vi.InputNode>command.node).dataset;
          if (!dataset.glue) {
            throw Error('Only Glue dataset can use metastore sync.');
          }
          const task = new MetastoreSyncConstruct(this, `op-${i}`, {
            db: dataset.glue.db!,
            table: dataset.glue.table!,
            source: 'datacatalog',
            partition: dataset.glue.partition!,
          }).task;
          chain = chain.next(task);
          break;
        }
        case ir.OP.OutputMetastoreSync: {
          const dataset = (<vi.OutputNode>command.node).dataset;
          if (!dataset.glue) {
            throw Error('Only Glue dataset can use metastore sync.');
          }
          const task = new MetastoreSyncConstruct(this, `op-${i}`, {
            db: dataset.glue.db!,
            table: dataset.glue.table!,
            source: 'datacatalog',
          }).task;
          chain = chain.next(task);
          break;
        }
        case ir.OP.OutputMetastoreSyncBack: {
          const dataset = (<vi.OutputNode>command.node).dataset;
          if (!dataset.glue) {
            throw Error('Only Glue dataset can use metastore sync.');
          }
          const task = new MetastoreSyncConstruct(this, `op-${i}`, {
            db: dataset.glue.db!,
            table: dataset.glue.table!,
            source: 'hive',
            partition: dataset.glue.partition!,
          }).task;
          chain = chain.next(task);
          break;
        }
        default:
          // console.log("To be supported, no-op for now.")
      }
    }

    const emrStepFunction = new sfn.StateMachine(this, 'MoonsetStateMachine', {
      definition: chain,
    });
    cdk.Tag.add(emrStepFunction, MC.TAG_MOONSET_TYPE, MC.TAG_MOONSET_TYPE_SF);
    cdk.Tag.add(emrStepFunction, MC.TAG_MOONSET_ID, props.id);
  }
}

new MoonsetApp().app.synth();
