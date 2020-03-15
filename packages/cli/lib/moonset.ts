import * as yargs from 'yargs';
import {logger} from './log';
import {ask} from './config';
import {Executor} from '@moonset/executor';

export class Moonset {
  async run() {
    const argv = yargs
        .command(['config'], 'configure the crendentials.')
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
    const cmd = argv._[0];
    switch (cmd) {
      case 'config':
        ask();
        return;
      case 'deploy':
        await new Executor().deploy(argv.job);
        return;
      case 'run':
        logger.info('Not implemented yet.');
        return;
      case 'ir':
        new Executor().ir(argv.job);
        return;
      default:
        throw new Error('Unknown command: ' + cmd);
    }
  }
}

new Moonset().run();
