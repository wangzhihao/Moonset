import * as path from 'path';
import * as execa from 'execa';
import {PluginHost} from './plugin';
import {MoonsetConstants as MC} from './constants';

export class CDKApp {
  private APP_FILENAME: string;

  constructor(private appPath: string) {
    this.APP_FILENAME = path.basename(appPath);
  }

  public async deploy(...args: string[]) {
    const cdkPlugins = PluginHost.instance.cdkPlugins.map(p => {
        return `--plugin=${p}`;
      });
    await this.execute([
      'deploy',
      '*',
      ...args,
      ...cdkPlugins,
      `--app=${path.join(
          MC.BUILD_TMP_DIR, MC.CDK_OUT_DIR, this.APP_FILENAME)}`,
    ]);
  }

  public async synth(...args: string[]) {
    await this.execute([
      'synth',
      ...args,
      `--app="node ${this.appPath}"`,
      `--output=${path.join(
          MC.BUILD_TMP_DIR, MC.CDK_OUT_DIR, this.APP_FILENAME)}`,
    ]);
  }

  private async execute(args: string[]) {
    const command = execa(
        `${require.resolve('aws-cdk/bin/cdk')}`,
        args,
        {stdio: ['ignore', 'pipe', 'pipe']},
    );

    if (command.stdout) {
      command.stdout.pipe(process.stdout);
    }
    if (command.stderr) {
      command.stderr.pipe(process.stderr);
    }
    await command;
  }
}
