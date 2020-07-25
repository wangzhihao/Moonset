import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as ec2 from '@aws-cdk/aws-ec2';
import {PluginHost, MoonsetConstants as MC} from '@moonset/executor';
import {Platform, EMRConstants as EC} from './constants';
import {CommonConstants as C} from '@moonset/util';
import {ConfigConstant as CC} from '@moonset/util';

/**
 * This helper class setup EMR related CDK resources.
 */
export class CDKResourceManager {
  constructor(
      private host: PluginHost,
      private platform: Platform) {
  }

  setup() {
    const c = this.host.constructs;

    const stack = c[EC.EMR_STACK] = new cdk.Stack(<cdk.App>c[MC.CDK_APP],
        EC.EMR_STACK + '-' + this.host.session, {
          env: {
            account: process.env[CC.WORKING_ACCOUNT],
            region: process.env[CC.WORKING_REGION],
          },
        });

    // eslint-disable-next-line
    const ec2Role = c[EC.EMR_EC2_ROLE] = new iam.Role(stack, EC.EMR_EC2_ROLE, {
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
    ec2Role.addToPolicy(
        new iam.PolicyStatement({
          actions: ['sts:AssumeRole'],
          resources: ['*'],
        }));
    // eslint-disable-next-line
    cdk.Tag.add(ec2Role, C.TAG_MOONSET_TYPE, EC.TAG_MOONSET_TYPE_EMR_EC2_ROLE);

    // eslint-disable-next-line
    new iam.CfnInstanceProfile(stack, EC.EMR_EC2_PROFILE, {
      roles: [ec2Role.roleName],
      instanceProfileName: ec2Role.roleName,
    });

    const emrRole = new iam.Role(stack, EC.EMR_ROLE, {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
    });

    emrRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonElasticMapReduceRole'));
    // eslint-disable-next-line
    cdk.Tag.add(emrRole, C.TAG_MOONSET_TYPE, EC.TAG_MOONSET_TYPE_EMR_ROLE);

    // TODO Why we need this role?
    // eslint-disable-next-line
    new iam.CfnServiceLinkedRole(stack, 'AWSServiceRoleForEMRCleanup', {
      awsServiceName: 'elasticmapreduce.amazonaws.com',
      // eslint-disable-next-line
      description: 'Allows EMR to terminate instances and delete resources from EC2 on your behalf.',
    });

    const emrSg = <ec2.SecurityGroup>c[MC.VPC_SG];
    const serviceSg = new ec2.SecurityGroup(c[MC.INFRA_STACK], 'serviceSg', {
      vpc: <ec2.Vpc>c[MC.VPC],
    });
    // eslint-disable-next-line
    cdk.Tag.add(serviceSg, C.TAG_MOONSET_TYPE, EC.TAG_MOONSET_TYPE_SERVICE_SECURITY_GROUP);
    // To prevent AWS EMR auto create ingress/egress rule.
    serviceSg.addEgressRule(emrSg, ec2.Port.tcp(8443));
    emrSg.addIngressRule(serviceSg, ec2.Port.tcp(8443));

    // Setup the Step Function IAM Role
    // TODO: EMR SDK don't need this resource, can we set it only for EMR SF?
    // eslint-disable-next-line
    const sfRole = new iam.Role(stack, EC.SF_ROLE, {
      assumedBy: new iam.ServicePrincipal(`states.${process.env[CC.WORKING_REGION]}.amazonaws.com`),
    });
    sfRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['elasticmapreduce:*'],
          resources: ['*'],
        }));
    sfRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: ['*'],
        }));

    // eslint-disable-next-line
    cdk.Tag.add(sfRole, C.TAG_MOONSET_TYPE, EC.TAG_MOONSET_TYPE_SF_ROLE);
  }
}
