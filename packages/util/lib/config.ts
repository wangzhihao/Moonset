import {Serde} from './serde';
import * as inquirer from 'inquirer';
import * as os from 'os';
import * as path from 'path';

const CONFIG_FILE = '.moonsetrc';
const CONFIG_PATH = path.join(os.homedir(), CONFIG_FILE);

export const ConfigConstant = {
  WORKING_ACCOUNT: 'WORKING_ACCOUNT',
  WORKING_REGION: 'WORKING_REGION',
  WORKING_ACCESS_KEY: 'WORKING_ACCESS_KEY',
  WORKING_SECRET_KEY: 'WORKING_SECRET_KEY',
  EMR_LOG: 'EMR_LOG',
  EMR_KEY_PAIR: 'EMR_KEY_PAIR',
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
  {
    type: 'input',
    name: ConfigConstant.EMR_LOG,
    message: 'The EMR log location in S3.',
  },
  {
    type: 'input',
    name: ConfigConstant.EMR_KEY_PAIR,
    message: 'The EMR Key Pair.',
  },
];

export class Config {
  static get(key: string) {
    const data = Serde.fromFile<{[k: string]: string}>(CONFIG_PATH);
    if (!data[key]) {
      throw Error(`${key} doesn't exist in ${CONFIG_PATH}.`);
    }
    return data[key];
  }

  static ask() {
    inquirer.prompt(questions).then((answers) => {
      console.log(`Write into ${CONFIG_PATH}`);
      Serde.toFile(answers, CONFIG_PATH);
    });
  }
}
