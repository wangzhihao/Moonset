import * as inquirer from 'inquirer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CONFIG_FILE = '.moonsetrc';
const CONFIG_PATH = path.join(os.homedir(), CONFIG_FILE);

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
    type: 'input',
    name: ConfigConstant.WORKING_SECRET_KEY,
    message: 'The working aws account secret key.',
  },
];

export class Config {
  static get(key: string) {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return data[key];
  }

  static ask() {
    inquirer.prompt(questions).then((answers) => {
      console.log(`Write into ${CONFIG_PATH}`);
      const content = JSON.stringify(answers, null, 4);
      fs.writeFileSync(CONFIG_PATH, content, 'utf8');
    });
  }
}
