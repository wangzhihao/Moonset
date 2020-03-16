import {v4 as uuid} from 'uuid';
// eslint-disable-next-line
import * as vi from './visitor';
import * as ir from './ir';
import * as cdk from './cdk';
import * as aws from 'aws-sdk';
import * as TagAPI from 'aws-sdk/clients/resourcegroupstaggingapi';
import {MoonsetConstants as MC} from './constants';
import {Config, ConfigConstant as CC, logger} from '@moonset/util';
import * as execa from 'execa';

export class Deployment {
  private async initSDK() {
    if (!aws.config.region) {
      aws.config.update({
      region: Config.get(CC.WORKING_REGION)
      });
    }
  }

  private async deploy(context: cdk.MoonsetProps) {
    // Deploy
    const command = execa(`${require.resolve('aws-cdk/bin/cdk')}`, [
      'deploy',
      '*',
      '--requireApproval=never',
      `--tags="${MC.TAG_MOONSET_ID}=${context.id}"`, // tags all resources
      `--app=${MC.BUILD_TMP_DIR}`,
    ], {stdio: ['ignore', 'pipe', 'pipe']});

    if (command.stdout) {
      command.stdout.pipe(process.stdout);
    }
    if (command.stderr) {
      command.stderr.pipe(process.stderr);
    }
    await command;
  }

  private async invoke(context: cdk.MoonsetProps) {
    await this.initSDK();

    const tagsClient = new TagAPI();
    const resources = await tagsClient.getResources({
      TagFilters: [
        {Key: MC.TAG_MOONSET_TYPE, Values: [MC.TAG_MOONSET_TYPE_SF]},
        {Key: MC.TAG_MOONSET_ID, Values: [context.id]},
      ],
      ResourceTypeFilters: [
        'states:stateMachine',
      ],
    }).promise();

    if ( !resources ||
            !resources.ResourceTagMappingList ||
            resources.ResourceTagMappingList.length != 1 ||
            !resources.ResourceTagMappingList[0].ResourceARN
    ) {
      throw new Error('The state machine should be uniquely identified.');
    }

    const sfnClient = new aws.StepFunctions();
    await sfnClient.startExecution({
      stateMachineArn: resources.ResourceTagMappingList[0].ResourceARN,
    }).promise();
  }

  async start(root: vi.RootNode) {
    const startTime = Date.now();

    const commands: ir.IR[] = [];
    root.accept(new ir.DeployVisitor(), commands);

    const props: cdk.MoonsetProps = {
      id: uuid(),
      commands,
      emrApplications: ['Hive', 'Spark'],
    };

    const moonsetApp = new cdk.MoonsetApp(props);

    const composeTime = Date.now();

    moonsetApp.app.synth();

    const synthTime = Date.now();


    // Before creating a change set, cdk deploy will compare the template and
    // tags of the currently deployed stack to the template and tags that are
    // about to be deployed and will skip deployment if they are identical.
    //
    // TODO However, since our tags contains UUID. every time it will redeploy
    // even the template is identical. We might need to change UUID to a
    // stable but unique tag.
    await this.deploy(props);

    const deployTime = Date.now();

    await this.invoke(props);

    const invokeTime = Date.now();

    logger.info(`Compose time: ${(composeTime - startTime) / 1000} seconds`);
    logger.info(`Synthesis time: ${(synthTime - composeTime) / 1000} seconds`);
    logger.info(`Deploy time: ${(deployTime - synthTime) / 1000} seconds`);
    logger.info(`Invoke time: ${(invokeTime - deployTime) / 1000} seconds`);
    logger.info(`Total time: ${(invokeTime - startTime) / 1000} seconds`);
  }
}
