import {Job} from '@moonset/model';
import * as vi from './visitor';
import * as ir from './ir';
import {logger} from '@moonset/util';
import {Deployment} from './deploy';
import {Run} from './run';


export class Executor {
  constructor() {}

  async deploy(job: any) {
    await new Deployment().start(this.getRootNode(job));
  }
  async run(job: any) {
    await new Run().start(this.getRootNode(job));
  }
  ir(job: any): ir.IR2[] {
    const root = this.getRootNode(job);
    const states: ir.IR2[] = [];
    root.accept(new ir.RunVisitor(), states);
    return states;
  }
  private getRootNode(job: any): vi.RootNode {
    const jobInput = job instanceof Array ? job : [job];
    const jobs = jobInput.map((x) => {
      const obj = JSON.parse(x);
      const err = Job.verify(obj);
      if (err) {
        throw new Error('Bad Input: ' + err);
      }
      return Job.create(obj);
    });
    return new vi.RootNode(jobs);
  }
}
