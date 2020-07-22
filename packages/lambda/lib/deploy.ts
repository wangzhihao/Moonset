import {v4 as uuid} from 'uuid';
// eslint-disable-next-line
import * as vi from './visitor';
import * as ir from './ir';
import {PluginHost} from './plugin';
import * as cdk from './cdk';
import {MoonsetConstants as MC} from './constants';
import {Config, ConfigConstant as CC, logger, Serde} from '@moonset/util';
import {CommonConstants as MCC} from '@moonset/util';
import {ISDK, SDKProvider, CDKApp} from '@moonset/util';
import * as execa from 'execa';
import * as path from 'path';

export class Deploy{

  private sdk: ISDK;

  private cdkApp = new CDKApp(
      path.resolve(__dirname, 'cdk', 'lambda-app.js')
  );

  async start() {
    const startTime = Date.now();
    this.sdk = await SDKProvider.forWorkingAccount();
    const session = await this.sdk.getSession();
    Serde.toFile({
        session
    }, path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

    await this.cdkApp.synth([]);

    const synthTime = Date.now();
    //TODO Add back the CDK plugins. 
    await this.cdkApp.deploy([
      `--tags="${MCC.MOONSET_SESSION}=${session}"`, //tags all resources
      '--requireApproval=never',
    ]);

    const deployTime = Date.now();


    logger.info(`Synthesis time: ${(synthTime - startTime) / 1000} seconds`);
    logger.info(`Deploy time: ${(deployTime - synthTime) / 1000} seconds`);
    logger.info(`Total time: ${(deployTime - startTime) / 1000} seconds`);
  }
}

new Deploy().start();
