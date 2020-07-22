import * as path from 'path';
import * as execa from 'execa';

export class CDKApp {
  public readonly BUILD_TMP_DIR = './build/';
  public readonly CDK_OUT_DIR = 'cdk.out/';
  private APP_FILENAME: string;

  constructor(private appPath: string) {
    this.APP_FILENAME = path.basename(appPath);
  }

  public async deploy(args: string[]) {
    await this.execute([
      'deploy',
      '*',
      ...args,
      `--app=${path.join(
          this.BUILD_TMP_DIR, this.CDK_OUT_DIR, this.APP_FILENAME)}`,
    ]);
  }

  public async synth(args: string[]) {
    await this.execute([
      'synth',
      ...args,
      `--app="node ${this.appPath}"`,
      `--output=${path.join(
          this.BUILD_TMP_DIR, this.CDK_OUT_DIR, this.APP_FILENAME)}`,
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
