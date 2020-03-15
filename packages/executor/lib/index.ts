import {Job} from '@moonset/model';
import * as vi from './visitor';
import * as ir from './ir';
import {logger} from './log';
import {Deployment} from './deploy';


export class Executor {
  constructor() {}

  async deploy(job: any) {
    await new Deployment().start(this.getRootNode(job));
  }
  ir(job: any) {
    const root = this.getRootNode(job);
    const states: ir.IR[] = [];
    root.accept(new ir.DeployVisitor(), states);
    console.log(JSON.stringify(states));
  }
  private getRootNode(job: any): vi.RootNode {
    const jobInput = job instanceof Array ? job : [job];
    const jobs = jobInput.map((x) => {
      const obj = JSON.parse(x);
      const err = Job.verify(obj);
      if (err) {
        logger.error('Bad Input:', err);
        process.exit(-1);
      }
      return Job.create(obj);
    });
    return new vi.RootNode(jobs);
  }
}
