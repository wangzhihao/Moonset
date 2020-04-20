import * as cdk from '@aws-cdk/core';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as sfnTasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as iam from '@aws-cdk/aws-iam';
// eslint-disable-next-line
import * as ec2 from '@aws-cdk/aws-ec2';
import {Config, ConfigConstant as CC} from '@moonset/util';
// eslint-disable-next-line
import {PluginHost, MoonsetConstants as MC} from '@moonset/executor';


export class EmrPlatformPlugin {
  version: '1';

  type: string = 'EMR';

  EMR_STACK = 'MoonsetEmrStack';
  EMR_EC2_ROLE = 'MoonsetEmrEc2Role';
  EMR_EC2_PROFILE = 'MoonsetEmrEc2Profile';
  EMR_ROLE = 'MoonsetEmrRole';
  SCRIPT_RUNNER = 's3://elasticmapreduce/libs/script-runner/script-runner.jar';

  init(host: PluginHost) {
    const c = host.constructs;

    const props = {
      id: 'foo', // TODO should be passed from outside and consistent.
      emrApplications: ['Hive', 'Spark'],
    };

    c[this.EMR_STACK] = new cdk.Stack(<cdk.App>c[MC.CDK_APP], this.EMR_STACK, {
      env: {
        account: Config.get(CC.WORKING_ACCOUNT),
        region: Config.get(CC.WORKING_REGION),
      },
    });

    // eslint-disable-next-line
    const ec2Role = new iam.Role(<cdk.Stack>c[this.EMR_STACK], this.EMR_EC2_ROLE, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    ec2Role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonElasticMapReduceforEC2Role'));
    ec2Role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'AmazonSSMManagedInstanceCore'));
    ec2Role.addToPolicy(
        new iam.PolicyStatement({
          actions: ['kms:*'],
          resources: ['*'],
        }));

    // eslint-disable-next-line
    new iam.CfnInstanceProfile(<cdk.Stack>c[this.EMR_STACK], this.EMR_EC2_PROFILE, {
      roles: [ec2Role.roleName],
      instanceProfileName: ec2Role.roleName,
    });

    const emrRole = new iam.Role(<cdk.Stack>c[this.EMR_STACK], this.EMR_ROLE, {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
    });

    emrRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonElasticMapReduceRole'));

    // eslint-disable-next-line
    new iam.CfnServiceLinkedRole(<cdk.Stack>c[this.EMR_STACK], 'AWSServiceRoleForEMRCleanup', {
      awsServiceName: 'elasticmapreduce.amazonaws.com',
      // eslint-disable-next-line
      description: 'Allows EMR to terminate instances and delete resources from EC2 on your behalf.',
    });

    const emrSettings = new sfn.Pass(<cdk.Stack>c[MC.SF_STACK], 'emrSettings', {
      result: sfn.Result.fromObject({
        ClusterName: `MoonsetEMR-${props.id}`,
      }),
      resultPath: '$.EmrSettings',
    });

    host.commands.push(emrSettings);

    // eslint-disable-next-line
    const emrCreateTask = new sfn.Task(<cdk.Stack>c[MC.SF_STACK], 'emrCluster', {
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
          ec2SubnetId: (<ec2.Vpc>c[MC.VPC]).privateSubnets[0].subnetId,
          // additionalMasterSecurityGroups: [sg.securityGroupId], // TODO
        },
        integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
      }),
      resultPath: '$.EmrSettings',
    });

    host.commands.push(emrCreateTask);
  }

  // task(host: PluginHost, taskType: string, data: any) {

  // }
}
