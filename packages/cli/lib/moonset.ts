import 'source-map-support/register';
import * as yargs from 'yargs';
import {PluginHost, Executor} from '@moonset/executor';
import {Config, ConfigConstant as CC, logger, CONFIG_PATH} from '@moonset/util';

export class Moonset {
  async run() {
    const argv = yargs
        .option('account', {type: 'string', desc: 'The working account',
          requiresArg: true})
        .option('region', {type: 'string', desc: 'The working region',
          requiresArg: true})
        .option('plugin', {type: 'string', desc: 'load plugin',
          requiresArg: true})
        .command(['config'], 'Configure the crendentials.')
        .command(['deploy'], 'Deploy the job.',
            (yargs) => yargs
                .option('job', {type: 'string', desc: 'job payload',
                  requiresArg: true, demandOption: true}))
        .command(['run'], 'Run the job.',
            (yargs) => yargs
                .option('job', {type: 'string', desc: 'job payload',
                  requiresArg: true, demandOption: true}))
        .command(['ir'], 'Show the intermediate representation.',
            (yargs) => yargs
                .option('job', {type: 'string', desc: 'job payload',
                  requiresArg: true, demandOption: true}))
        .argv;

    logger.debug('Command line arguments:', argv);

    this.loadPlugins(argv.plugin);
    this.initEnvs(argv);

    const cmd = argv._[0];
    switch (cmd) {
      case 'config':
        Config.ask();
        return;
      case 'deploy':
        logger.info('Not implemented yet.');
        return;
      case 'run':
        await new Executor().run(argv.job);
        return;
      case 'ir':
        const states = new Executor().ir(argv.job);
        console.log(JSON.stringify(states));
        return;
      default:
        throw new Error('Unknown command: ' + cmd);
    }
  }

  private loadPlugins(plugin: any) {
    if (plugin) {
      const plugins = Array.isArray(plugin) ? plugin : [plugin];
      plugins.forEach((plugin) => {
        PluginHost.instance.load(plugin);
      });
    }
    logger.info(`The plugins: ${plugin}. ` +
          `The hooks: ${Object.keys(PluginHost.instance.hooks)}.`);
  }

  private initEnvs(argv: any) {
    if (Config.get(CC.WORKING_ACCOUNT)) {
      process.env[CC.WORKING_ACCOUNT] = Config.get(CC.WORKING_ACCOUNT);
    }
    if (Config.get(CC.WORKING_REGION)) {
      process.env[CC.WORKING_REGION] = Config.get(CC.WORKING_REGION);
    }
    if (argv.account) {
      if (Array.isArray(argv.account)) {
        argv.account = argv.account[argv.account.length - 1];
      }
      process.env[CC.WORKING_ACCOUNT] = argv.account;
    }
    if (argv.region) {
      if (Array.isArray(argv.region)) {
        argv.region = argv.region[argv.region.length - 1];
      }
      process.env[CC.WORKING_REGION] = argv.region;
    }
    // TODO: This env credentials will be read during cdk deploy. This will
    // be problematic when we have multiple accounts like working account
    // and reference accounts. Currently we have only working account
    // so it's fine for now.
    //
    // We might want to support a very simple CDK plugin to support working
    // account and reference account's credentials.

    if (!process.env['AWS_ACCESS_KEY_ID'] &&
        Config.get(CC.WORKING_ACCESS_KEY)) {
      logger.info(`Fetch AWS_ACCESS_KEY_ID from ${CONFIG_PATH}`);
      process.env['AWS_ACCESS_KEY_ID'] =
            Config.get(CC.WORKING_ACCESS_KEY);
    }
    if (!process.env['AWS_SECRET_ACCESS_KEY']&&
        Config.get(CC.WORKING_SECRET_KEY)) {
      logger.info(`Fetch AWS_SECRET_ACCESS_KEY from ${CONFIG_PATH}`);
      process.env['AWS_SECRET_ACCESS_KEY'] =
            Config.get(CC.WORKING_SECRET_KEY);
    }
  }
}

new Moonset().run();
