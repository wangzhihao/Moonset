import * as cdk from '@aws-cdk/core';
import * as sfn from '@aws-cdk/aws-stepfunctions';

export class EmrPlatformPlugin {

  version: '1';

  type: string = 'EMR';

  init(host: PluginHost): sfn.IChainable {

    // https://github.com/aws/aws-cdk/issues/3704
    const vpc = new ec2.Vpc(this.getEmrStack(), 'MoonsetVPC', {
      maxAzs: 1,
    });

    const sg = new ec2.SecurityGroup(this.getEmrStack(), 'MoonsetSG', {vpc});
    sg.addIngressRule(sg, ec2.Port.allTraffic());

    const ec2Role = new iam.Role(this.getEmrStack(), MC.EMR_EC2_ROLE, {
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

    new iam.CfnInstanceProfile(this.getEmrStack(), MC.EMR_EC2_PROFILE, {
      roles: [ec2Role.roleName],
      instanceProfileName: ec2Role.roleName,
    });

    const emrRole = new iam.Role(this.getEmrStack(), MC.EMR_ROLE, {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
    });

    emrRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonElasticMapReduceRole'));

    new iam.CfnServiceLinkedRole(this.getEmrStack(), 'AWSServiceRoleForEMRCleanup', {
      awsServiceName: 'elasticmapreduce.amazonaws.com',
      // eslint-disable-next-line
      description: 'Allows EMR to terminate instances and delete resources from EC2 on your behalf.',
    });

    const emrSettings = new sfn.Pass(this.getStepFunctionStack(), 'emrSettings', {
      result: sfn.Result.fromObject({
        ClusterName: `MoonsetEMR-${props.id}`,
      }),
      resultPath: '$.EmrSettings',
    });

    let chain = sfn.Chain.start(emrSettings);

    const emrCreateTask = new sfn.Task(this.getStepFunctionStack(), 'emrCluster', {
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
          ec2SubnetId: vpc.privateSubnets[0].subnetId,
          additionalMasterSecurityGroups: [sg.securityGroupId],
        },
        integrationPattern: sfn.ServiceIntegrationPattern.SYNC,
      }),
      resultPath: '$.EmrSettings',
    });

    chain = chain.next(emrCreateTask);

    return chain;
  }

  execute(host: PluginHost, taskType: string, data: any): sfn.IChainable {

  }
}
