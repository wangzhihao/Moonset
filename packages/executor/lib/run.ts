import {v4 as uuid} from 'uuid';
// eslint-disable-next-line
import * as vi from './visitor';
import * as ir from './ir';
import {PluginHost} from './plugin';
import * as cdk from './cdk';
import {MoonsetConstants as MC} from './constants';
import {Config, ConfigConstant as CC, logger, Serde} from '@moonset/util';
import {CommonConstants as MCC} from '@moonset/util';
import {ISDK, SDKProvider} from '@moonset/util';
import * as execa from 'execa';
import * as path from 'path';

export class Run{

  private sdk: ISDK;

  // It might be a user or a role.
  private async getSession() {
    const sts = this.sdk.sts();
    const currentUser = await sts.getCallerIdentity().promise();
    const session = currentUser.Arn!
          .split('/')
          .slice(-1)[0]
          .replace(/[^A-Za-z0-9-]/g, '-');
    logger.info(`Current user is ${JSON.stringify(currentUser)},`
        + ` the extract session id is ${session}.`);
    return session;
  }

  private async deploy(session: string) {
      await this.execute([
      'deploy',
      '*',
      '--requireApproval=never',
      `--tags="${MCC.MOONSET_SESSION}=${session}"`, //tags all resources
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

  private async invoke(commands: ir.IR) {
      for (let command of commands.sdk) {
    const fn = PluginHost.instance.hooks[command.op];
    await fn(PluginHost.instance, ...command.args);
      }
  }

  async start(root: vi.RootNode) {
    const startTime = Date.now();

    const commands: ir.IR = {cdk: [], sdk: []};
    root.accept(new ir.RunVisitor(), commands);

    const id = uuid();

    this.sdk = await SDKProvider.forWorkingAccount();

    const session = await this.getSession();
    // TODO: we set session/id in two places for PluginHost.(Another one is in
    // moonset-app.ts) Can we merge them into one?
    PluginHost.instance.session = session;
    PluginHost.instance.id = id;
    Serde.toFile({
        id,
        commands,
        plugins: PluginHost.instance.plugins,
        session
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
    await this.deploy(session);

    const deployTime = Date.now();

    await this.invoke(commands);

    const invokeTime = Date.now();

    logger.info(`Synthesis time: ${(synthTime - startTime) / 1000} seconds`);
    logger.info(`Deploy time: ${(deployTime - synthTime) / 1000} seconds`);
    logger.info(`Invoke time: ${(invokeTime - deployTime) / 1000} seconds`);
    logger.info(`Total time: ${(invokeTime - startTime) / 1000} seconds`);
  }
}
