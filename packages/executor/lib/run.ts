import {v4 as uuid} from 'uuid';
// eslint-disable-next-line
import * as vi from './visitor';
import * as ir from './ir';
import {PluginHost} from './plugin';
import * as cdk from './cdk';
import * as aws from 'aws-sdk';
import * as TagAPI from 'aws-sdk/clients/resourcegroupstaggingapi';
import {MoonsetConstants as MC} from './constants';
import {Config, ConfigConstant as CC, logger, Serde} from '@moonset/util';
import * as execa from 'execa';
import * as path from 'path';
import {CredentialPlugins} from 'aws-cdk/lib/api/aws-auth/credential-plugins';
import {Mode} from 'aws-cdk';

export class Run{
  private async initSDK() {
    if (!process.env[CC.WORKING_ACCOUNT]) {
        throw new Error("The working account is not specified.");
    }
    const credentials = await new CredentialPlugins().fetchCredentialsFor(
        process.env[CC.WORKING_ACCOUNT]!,
        Mode.ForWriting
    );
    
    if (credentials) {
        aws.config.credentials = credentials;
    }
    aws.config.region = process.env[CC.WORKING_REGION];
  }

  private async getCurrentUser() {
    const iam = new aws.IAM();
    const currentUser = await iam.getUser().promise();
    return currentUser;
  }

  private async deploy() {
      await this.execute([
      'deploy',
      '*',
      '--requireApproval=never',
      `--app=${path.join(MC.BUILD_TMP_DIR, MC.CDK_OUT_DIR)}`,
    ]);
  }

  private async synth() {
      await this.execute([
      'synth',
       `--app="node ${path.resolve(__dirname, 'cdk', 'moonset-app.js')}"`,
       `--output=${path.join(MC.BUILD_TMP_DIR, MC.CDK_OUT_DIR)}`
    ]);
  }

  private async execute(args: string[]) {
    const cdkPlugins = PluginHost.instance.cdkPlugins.map(p => {
        return `--plugin=${p}`;
      });
    const command = execa(
        `${require.resolve('aws-cdk/bin/cdk')}`,
        args.concat(cdkPlugins), 
        {stdio: ['ignore', 'pipe', 'pipe']}
    );

    if (command.stdout) {
      command.stdout.pipe(process.stdout);
    }
    if (command.stderr) {
      command.stderr.pipe(process.stderr);
    }
    await command;
  }

  private async invoke(id: string) {
    const tagsClient = new TagAPI();
    const resources = await tagsClient.getResources({
      TagFilters: [
        {Key: MC.TAG_MOONSET_TYPE, Values: [MC.TAG_MOONSET_TYPE_SF]},
        {Key: MC.TAG_MOONSET_ID, Values: [id]},
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
    root.accept(new ir.RunVisitor(), commands);

    const id = uuid();

    await this.initSDK();

    const currentUser = await this.getCurrentUser();

    Serde.toFile({
        id,
        commands,
        plugins: PluginHost.instance.plugins,
        userName: currentUser.User.UserName,
    }, path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

    await this.synth();

    const synthTime = Date.now();

    // Before creating a change set, cdk deploy will compare the template and
    // tags of the currently deployed stack to the template and tags that are
    // about to be deployed and will skip deployment if they are identical.
    //
    // TODO However, since our tags contains UUID. every time it will redeploy
    // even the template is identical. We might need to change UUID to a
    // stable but unique tag.
    await this.deploy();

    const deployTime = Date.now();

    await this.invoke(id);

    const invokeTime = Date.now();

    logger.info(`Synthesis time: ${(synthTime - startTime) / 1000} seconds`);
    logger.info(`Deploy time: ${(deployTime - synthTime) / 1000} seconds`);
    logger.info(`Invoke time: ${(invokeTime - deployTime) / 1000} seconds`);
    logger.info(`Total time: ${(invokeTime - startTime) / 1000} seconds`);
  }
}
