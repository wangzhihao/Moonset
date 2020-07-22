export class CDKApp {

  public readonly BUILD_TMP_DIR = './build/';
  public readonly CDK_OUT_DIR = 'cdk.out/';
  private APP_FILENAME: string;

  constructor(private appPath: string) {
      APP_FILENAME = path.basename(appPath);
  }

  public async deploy(args: string[]) {
      await this.execute([
      'deploy',
      '*',
       args, 
      `--app=${path.join(BUILD_TMP_DIR, CDK_OUT_DIR, APP_FILENAME)}`,
    ]);
  }

  public async synth(args: string[]) {
      await this.execute([
      'synth',
        args, 
       `--app="node ${this.appPath}"`,
       `--output=${path.join(BUILD_TMP_DIR, CDK_OUT_DIR, APP_FILENAME)}`
    ]);
  }

  private async execute(args: string[]) {
    const command = execa(
        `${require.resolve('aws-cdk/bin/cdk')}`,
        args, 
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
}
