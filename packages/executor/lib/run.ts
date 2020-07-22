import {v4 as uuid} from 'uuid';
import * as vi from './visitor';
import * as ir from './ir';
import {PluginHost} from './plugin';
import {MoonsetConstants as MC} from './constants';
import {CDKApp} from './cdk-exec';
import {Config, ConfigConstant as CC, logger, Serde} from '@moonset/util';
import {CommonConstants as MCC} from '@moonset/util';
import {ISDK, SDKProvider} from '@moonset/util';
import * as path from 'path';

export class Run{

  private sdk: ISDK;
  private cdkApp = new CDKApp(
      path.resolve(__dirname, 'cdk', 'moonset-app.js'));

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

    const session = await this.sdk.getSession();
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

    await this.cdkApp.synth();

    const synthTime = Date.now();

    await this.cdkApp.deploy(
      '--requireApproval=never',
      `--tags="${MCC.MOONSET_SESSION}=${session}"`, //tags all resources
    );

    const deployTime = Date.now();

    await this.invoke(commands);

    const invokeTime = Date.now();

    logger.info(`Synthesis time: ${(synthTime - startTime) / 1000} seconds`);
    logger.info(`Deploy time: ${(deployTime - synthTime) / 1000} seconds`);
    logger.info(`Invoke time: ${(invokeTime - deployTime) / 1000} seconds`);
    logger.info(`Total time: ${(invokeTime - startTime) / 1000} seconds`);
  }
}
