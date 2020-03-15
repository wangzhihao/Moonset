import * as inquirer from 'inquirer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const questions = [
  {
    type: 'input',
    name: 'working_account',
    message: 'The working aws account which you have write permission,' +
  ' e.g. EMR is launched here.',
  },
  {
    type: 'input',
    name: 'working_region',
    message: 'The region using in the working aws account.',
  },
  {
    type: 'input',
    name: 'working_access_key',
    message: 'The working aws account access key.',
  },
  {
    type: 'input',
    name: 'working_secret_key',
    message: 'The working aws account secret key.',
  },
];
export function ask() {
  inquirer.prompt(questions).then((answers) => {
    console.log('Write into ~/.moonsetrc');
    const content = JSON.stringify(answers, null, 4);
    fs.writeFileSync(path.join(os.homedir(), '.moonsetrc'), content, 'utf8');
  });
}
