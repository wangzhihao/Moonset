import {Serde} from './serde';
import * as inquirer from 'inquirer';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILE = '.moonsetrc';
export const CONFIG_PATH = path.join(os.homedir(), CONFIG_FILE);

export const ConfigConstant = {
  WORKING_ACCOUNT: 'WORKING_ACCOUNT',
  WORKING_REGION: 'WORKING_REGION',
  WORKING_ACCESS_KEY: 'WORKING_ACCESS_KEY',
  WORKING_SECRET_KEY: 'WORKING_SECRET_KEY',
};

const questions = [
  {
    type: 'input',
    name: ConfigConstant.WORKING_ACCOUNT,
    message: 'The working aws account which you have write permission,' +
        ' e.g. EMR is launched here.',
  },
  {
    type: 'input',
    name: ConfigConstant.WORKING_REGION,
    message: 'The region using in the working aws account.',
  },
  {
    type: 'input',
    name: ConfigConstant.WORKING_ACCESS_KEY,
    message: 'The working aws account access key.',
  },
  {
    type: 'password',
    name: ConfigConstant.WORKING_SECRET_KEY,
    message: 'The working aws account secret key.',
  },
];

export class Config {
  static get(key: string) {
    if (!fs.existsSync(CONFIG_PATH)) return undefined;
    const data = Serde.fromFile<{[k: string]: string}>(CONFIG_PATH);
    return data[key];
  }

  static ask() {
    inquirer.prompt(questions).then((answers) => {
      console.log(`Write into ${CONFIG_PATH}`);
      Serde.toFile(answers, CONFIG_PATH);
    });
  }
}
