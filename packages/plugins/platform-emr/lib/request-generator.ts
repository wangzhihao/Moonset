import {PluginHost, MoonsetConstants as MC} from '@moonset/executor';
import * as EMR from 'aws-sdk/clients/emr';
import {CDKResourceReader, logger} from '@moonset/util';
import {ISDK, SDKProvider, S3AssetUploader} from '@moonset/util';
import {Platform, EMRConstants as EC} from './constants';
import {CommonConstants as C} from '@moonset/util';

/**
 * This helper class generate EMR related requests for both EMR SDK and Step
 * Function usage. Step Function shares the same request syntax with EMR SDK.
 *
 * https://docs.aws.amazon.com/step-functions/latest/dg/connect-emr.html
 */
export class RequestGenerator {
  constructor(
      private host: PluginHost,
      private platform: Platform,
      private resources: CDKResourceReader) {
  }


  async getRunJobFlowInput(): Promise<EMR.Types.RunJobFlowInput> {
    /* eslint-disable */
    let params = {
        Name: `MoonsetEMR-${this.host.session}-${this.host.id}`,
        Instances: {
            // TODO: Instead override item by item, we can allow user to provide
            // a custom EMR.Types.RunJobFlowInput and override our settings.
            InstanceCount: this.host.settings.instanceCount || 3,
            MasterInstanceType: this.host.settings.masterInstanceType || 'm5.xlarge',
            SlaveInstanceType: this.host.settings.slaveInstanceType || 'm5.xlarge',
            Ec2SubnetId: (await this.resources.findPrivateSubnet(MC.TAG_MOONSET_TYPE_VPC)).SubnetId!,
            EmrManagedSlaveSecurityGroup: (await this.resources.findSecurityGroup(MC.TAG_MOONSET_TYPE_VPC_SERCURITY_GROUP)).GroupId!, 
            EmrManagedMasterSecurityGroup: (await this.resources.findSecurityGroup(MC.TAG_MOONSET_TYPE_VPC_SERCURITY_GROUP)).GroupId!, 
            ServiceAccessSecurityGroup: (await this.resources.findSecurityGroup(EC.TAG_MOONSET_TYPE_SERVICE_SECURITY_GROUP)).GroupId!,
            KeepJobFlowAliveWhenNoSteps: true,
        },
        JobFlowRole: (await this.resources.findRole(EC.TAG_MOONSET_TYPE_EMR_EC2_ROLE)).RoleName!,
        VisibleToAllUsers: true,
        LogUri: `s3://${await this.resources.findS3Bucket(MC.TAG_MOONSET_TYPE_LOG_S3_BUCEKT)}/emr_logs`,
        ServiceRole: (await this.resources.findRole(EC.TAG_MOONSET_TYPE_EMR_ROLE)).RoleName!,
        ReleaseLabel: this.host.settings.releaseLabel || 'emr-5.29.0',
        Tags: [
              { Key: C.MOONSET_SESSION, Value: this.host.session },
              { Key: C.MOONSET_ID, Value: this.host.id},
              { Key: C.TAG_MOONSET_TYPE , Value: EC.TAG_MOONSET_TYPE_EMR},
          ],
        Applications: [
            {Name: 'Spark'}, {Name: 'Hive'}
        ]
    };
    /* eslint-enable*/
    return params;
  }

  async getStepConfig(type: string, task: any): Promise<EMR.Types.StepConfig> {
    const sdk = await SDKProvider.forWorkingAccount();
    const s3AssetUploader = new S3AssetUploader(
        await this.resources.findS3Bucket(MC.TAG_MOONSET_TYPE_LOG_S3_BUCEKT),
        'assets',
        this.host.session,
        this.host.id,
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
      return step;
    }
    throw Error(`Unknown type: ${type}`);
  }
}
