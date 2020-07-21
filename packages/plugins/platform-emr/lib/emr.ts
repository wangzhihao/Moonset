import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as ec2 from '@aws-cdk/aws-ec2';
import {ConfigConstant as CC, CDKResourceReader, logger} from '@moonset/util';
import {ISDK, SDKProvider, S3AssetUploader} from '@moonset/util';
import {CommonConstants as C} from '@moonset/util';
import {PluginHost, MoonsetConstants as MC} from '@moonset/executor';
import * as EMR from 'aws-sdk/clients/emr';

const TAG_MOONSET_TYPE_EMR = 'EMR';
const TAG_MOONSET_TYPE_SERVICE_SECURITY_GROUP = 'ServiceSecurityGroup';
const TAG_MOONSET_TYPE_EMR_EC2_ROLE = 'EmrEc2Role';
const TAG_MOONSET_TYPE_EMR_ROLE = 'EmrRole';

const EMR_STACK = 'MoonsetEmrStack';
const EMR_EC2_ROLE = 'MoonsetEmrEc2Role';
const EMR_EC2_PROFILE = 'MoonsetEmrEc2Profile';
const EMR_ROLE = 'MoonsetEmrRole';

const steps: EMR.Types.StepConfigList = [];

export = {
  version: '1',
  plugin: 'platform',
  type: 'emr',
  steps: steps,

  init(host: PluginHost) {
    const c = host.constructs;

    c[EMR_STACK] = new cdk.Stack(<cdk.App>c[MC.CDK_APP],
        EMR_STACK + '-' + host.session, {
          env: {
            account: process.env[CC.WORKING_ACCOUNT],
            region: process.env[CC.WORKING_REGION],
          },
        });

    // eslint-disable-next-line
    const ec2Role = new iam.Role(<cdk.Stack>c[EMR_STACK], EMR_EC2_ROLE, {
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
    cdk.Tag.add(ec2Role, C.TAG_MOONSET_TYPE, TAG_MOONSET_TYPE_EMR_EC2_ROLE);

    // eslint-disable-next-line
    new iam.CfnInstanceProfile(<cdk.Stack>c[EMR_STACK], EMR_EC2_PROFILE, {
      roles: [ec2Role.roleName],
      instanceProfileName: ec2Role.roleName,
    });

    const emrRole = new iam.Role(<cdk.Stack>c[EMR_STACK], EMR_ROLE, {
      assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com'),
    });

    emrRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonElasticMapReduceRole'));
    // eslint-disable-next-line
    cdk.Tag.add(emrRole, C.TAG_MOONSET_TYPE, TAG_MOONSET_TYPE_EMR_ROLE);

    // TODO Why we need this role?
    // eslint-disable-next-line
    new iam.CfnServiceLinkedRole(<cdk.Stack>c[EMR_STACK], 'AWSServiceRoleForEMRCleanup', {
      awsServiceName: 'elasticmapreduce.amazonaws.com',
      // eslint-disable-next-line
      description: 'Allows EMR to terminate instances and delete resources from EC2 on your behalf.',
    });

    const emrSg = <ec2.SecurityGroup>c[MC.VPC_SG];
    const serviceSg = new ec2.SecurityGroup(c[MC.INFRA_STACK], 'serviceSg', {
      vpc: <ec2.Vpc>c[MC.VPC],
    });
    // eslint-disable-next-line
    cdk.Tag.add(serviceSg, C.TAG_MOONSET_TYPE, TAG_MOONSET_TYPE_SERVICE_SECURITY_GROUP);
    // To prevent AWS EMR auto create ingress/egress rule.
    serviceSg.addEgressRule(emrSg, ec2.Port.tcp(8443));
    emrSg.addIngressRule(serviceSg, ec2.Port.tcp(8443));
  },

  async task(host: PluginHost, type: string, task: any) {
    const sdk = await SDKProvider.forWorkingAccount();
    // For now we only have working account's cdk resources.
    const resources = new CDKResourceReader(host.session, sdk);
    const s3AssetUploader = new S3AssetUploader(
        await resources.findS3Bucket(MC.TAG_MOONSET_TYPE_LOG_S3_BUCEKT),
        'assets',
        host.session,
        host.id,
        sdk,
    );
    if (type === 'hive') {
      // TODO we need a cleanup service to delete unused s3 files. One
      // approach is to find them via the tags like session and id.
      let s3File;
      if (task.hive.sqlFile) {
        s3File = task.hive.sqlFile;
        if (!task.hive.sqlFile.startsWith('s3://')) {
          s3File = await s3AssetUploader.uploadFile(task.hive.sqlFile);
        }
      } else if (task.hive.sql) {
        s3File = await s3AssetUploader.uploadData(task.hive.sql);
      } else {
        throw Error('Either sqlFile or sql must exist for hive.');
      }

      const step = {
        Name: 'HiveTask',
        ActionOnFailure: 'TERMINATE_CLUSTER',
        HadoopJarStep: {
          Properties: [],
          Jar: MC.SCRIPT_RUNNER,
          Args: [
            's3://elasticmapreduce/libs/hive/hive-script',
            '--run-hive-script',
            '--args',
            '-f',
            s3File,
          ],
        },
      };
      steps.push(step);
    }
  },

  async run(host: PluginHost) {
    const sdk = await SDKProvider.forWorkingAccount();
    // For now we only have working account's cdk resources.
    const resources = new CDKResourceReader(host.session, sdk);
    // EMR runs in working account.
    const emr = sdk.emr();
    /* eslint-disable */
    const params = {
        Name: `MoonsetEMR-${host.session}-${host.id}`,
        Instances: {
            InstanceCount: host.settings.instanceCount || 3,
            MasterInstanceType: 'm5.xlarge',
            SlaveInstanceType: 'm5.xlarge',
            Ec2SubnetId: (await resources.findPrivateSubnet(MC.TAG_MOONSET_TYPE_VPC)).SubnetId!,
            EmrManagedSlaveSecurityGroup: (await resources.findSecurityGroup(MC.TAG_MOONSET_TYPE_VPC_SERCURITY_GROUP)).GroupId!, 
            EmrManagedMasterSecurityGroup: (await resources.findSecurityGroup(MC.TAG_MOONSET_TYPE_VPC_SERCURITY_GROUP)).GroupId!, 
            ServiceAccessSecurityGroup: (await resources.findSecurityGroup(TAG_MOONSET_TYPE_SERVICE_SECURITY_GROUP)).GroupId!,
            KeepJobFlowAliveWhenNoSteps: true,
        },
        JobFlowRole: (await resources.findRole(TAG_MOONSET_TYPE_EMR_EC2_ROLE)).RoleName!,
        VisibleToAllUsers: true,
        LogUri: `s3://${await resources.findS3Bucket(MC.TAG_MOONSET_TYPE_LOG_S3_BUCEKT)}/emr_logs`,
        ServiceRole: (await resources.findRole(TAG_MOONSET_TYPE_EMR_ROLE)).RoleName!,
        ReleaseLabel: host.settings.releaseLabel || 'emr-5.29.0',
        Applications: [
            {Name: 'Spark'}, {Name: 'Hive'}
        ],
        Steps: steps
    };
    /* eslint-enable */
    logger.info(`EMR will be created with params: ${JSON.stringify(params)}.`);
    await emr.runJobFlow(params).promise();
  },
}

