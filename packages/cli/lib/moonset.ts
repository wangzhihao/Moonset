import * as yargs from 'yargs';
import {PluginHost, Executor} from '@moonset/executor';
import {Config, ConfigConstant as CC, logger} from '@moonset/util';

export class Moonset {
  async run() {
    const argv = yargs
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

    this.initEnvs();
    if (argv.plugin) {
      const plugins = Array.isArray(argv.plugin) ? argv.plugin : [argv.plugin];
      plugins.forEach((plugin) => {
        PluginHost.instance.load(plugin);
      });
    }

    const cmd = argv._[0];
    switch (cmd) {
      case 'config':
        Config.ask();
        return;
      case 'deploy':
        await new Executor().deploy(argv.job);
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

  private initEnvs() {
    if (!process.env['AWS_ACCESS_KEY_ID'] &&
        Config.get(CC.WORKING_ACCESS_KEY)) {
      process.env['AWS_ACCESS_KEY_ID'] =
            Config.get(CC.WORKING_ACCESS_KEY);
    }
    if (!process.env['AWS_SECRET_ACCESS_KEY']&&
        Config.get(CC.WORKING_SECRET_KEY)) {
      process.env['AWS_SECRET_ACCESS_KEY'] =
            Config.get(CC.WORKING_SECRET_KEY);
    }
  }
}

new Moonset().run();
