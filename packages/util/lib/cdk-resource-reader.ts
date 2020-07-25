import {ISDK} from './sdk-utils';
import {CommonConstants as CC} from './constants';
import * as EC2 from 'aws-sdk/clients/ec2';
import * as IAM from 'aws-sdk/clients/iam';
import * as CFN from 'aws-sdk/clients/cloudformation';


/**
 * Moonset uses CDK to setup minimum required resources like VPC, role, s3 log
 * bucket etc, and then uses SDK to invoke the EMR. This helper class retrieve
 * the CDK generated resources for SDK's consumption.
 *
 */
export class CDKResourceReader {
  /**
     * Constructor.
     *
     * Arguments:
     *    session: To distinguish different moonset instances in the same
     *    account. Usally different sessions are created by different users.
     *
     *    sdk: The interface that represent AWS SDK. We need different sdk
     *    instances for different accounts such as the working account and
     *    reference accounts.
     *
     */
  constructor(private readonly session: string, private sdk: ISDK) {

  }

  async findSecurityGroup(tag: string): Promise<EC2.Types.SecurityGroup> {
    const ec2 = this.sdk.ec2();
    const params = {
      Filters: [
        {
          Name: `tag:${CC.MOONSET_SESSION}`,
          Values: [this.session],
        },
        {
          Name: `tag:${CC.TAG_MOONSET_TYPE}`,
          Values: [tag],
        },
      ],
    };
    const data = await ec2.describeSecurityGroups(params).promise();
    if (!data.SecurityGroups || data.SecurityGroups.length == 0) {
      throw new Error(`No Security Group found for tag: ${tag}.`);
    }
    if (data.SecurityGroups.length > 1) {
      throw new Error(`Multiple Security Group ${data.SecurityGroups} `+
          `found for tag: ${tag}.`);
    }
    return data.SecurityGroups[0];
  }

  async findVpc(tag: string): Promise<EC2.Types.Vpc> {
    const ec2 = this.sdk.ec2();
    const params = {
      Filters: [
        {
          Name: `tag:${CC.MOONSET_SESSION}`,
          Values: [this.session],
        },
        {
          Name: `tag:${CC.TAG_MOONSET_TYPE}`,
          Values: [tag],
        },
      ],
    };
    const data = await ec2.describeVpcs(params).promise();
    if (!data.Vpcs || data.Vpcs.length == 0) {
      throw new Error(`No Vpc found for tag: ${tag}.`);
    }
    if (data.Vpcs.length > 1) {
      throw new Error(`Multiple Vpcs ${data.Vpcs} `+
          `found for tag: ${tag}.`);
    }
    return data.Vpcs[0];
  }

  async findSubnets(tag: string): Promise<EC2.Types.SubnetList> {
    const ec2 = this.sdk.ec2();
    const params = {
      Filters: [
        {
          Name: 'vpc-id',
          Values: [
                      (await this.findVpc(tag)).VpcId!,
          ],
        },
      ],
    };
    const data = await ec2.describeSubnets(params).promise();
    if (!data.Subnets) {
      throw new Error(`No Subnets found for tag: ${tag}.`);
    }
    return data.Subnets;
  }

  async findPrivateSubnet(tag: string): Promise<EC2.Types.Subnet> {
    const subnets = await this.findSubnets(tag);
    return subnets.filter((s) => !s.MapPublicIpOnLaunch)[0];
  }

  /**
   * IAM Role API doesn't work well with Tag.
   * Check https://github.com/boto/boto3/issues/1855
   *
   * ResourceGroupsTaggingAPI also doesn't work well with IAM Role Tag. Check 
   * the support list: 
   * https://docs.aws.amazon.com/resourcegroupstagging/latest/APIReference/Welcome.html
   *
   * So we go through all roles and check the tag for each role.
   */
  async findRole(tag: string): Promise<IAM.Types.Role> {
    const iam = this.sdk.iam();
    const roles = [];
    let data = await iam.listRoles({}).promise();
    while (data.IsTruncated) {
      roles.push(...data.Roles);
      data = await iam.listRoles({
        Marker: data.Marker,
      }).promise();
    }
    roles.push(...data.Roles);

    const matchedRoles = [];
    for (const r of roles) {
      const tags = [];
      let data = await iam.listRoleTags({RoleName: r.RoleName}).promise();
      while (data.IsTruncated) {
        tags.push(...data.Tags);
        data = await iam.listRoleTags({
          RoleName: r.RoleName,
          Marker: data.Marker,
        }).promise();
      }
      tags.push(...data.Tags);
      if ( tags.filter((t) =>
        t.Key === CC.MOONSET_SESSION &&
        t.Value === this.session).length > 0 &&
        tags.filter((t) =>
          t.Key === CC.TAG_MOONSET_TYPE &&
        t.Value === tag).length > 0 ) {
        matchedRoles.push(r);
      }
    }
    if (!matchedRoles || matchedRoles.length == 0) {
      throw new Error(`No matchedRoles found for: ${tag}.`);
    }
    if (matchedRoles.length > 1) {
      throw new Error(`Multiple Roles ${matchedRoles} `+
          `found for: ${tag}.`);
    }
    return matchedRoles[0];
  }

  async findS3Bucket(tag: string): Promise<string> {
    const bucket = (await this.findResourceArn(tag))
      .replace('arn:aws:s3:::', '');
    return bucket;
  }

  async findResourceArn(tag: string): Promise<string> {
    const tagApi = this.sdk.tagApi();
    const resources = await tagApi.getResources({
      TagFilters: [
        {
          Key: CC.MOONSET_SESSION,
          Values: [this.session],
        },
        {
          Key: CC.TAG_MOONSET_TYPE,
          Values: [tag],
        },
      ],
    }).promise();
    if ( !resources ||
            !resources.ResourceTagMappingList ||
            resources.ResourceTagMappingList.length != 1 ||
            !resources.ResourceTagMappingList[0].ResourceARN
    ) {
      throw new Error(`The resource should be uniquely identified.`
          + `However we found ${JSON.stringify(resources)}.`);
    }
    return resources.ResourceTagMappingList[0].ResourceARN;
  }
}
