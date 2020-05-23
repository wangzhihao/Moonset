import * as vi from './visitor';
import {PluginHost} from './plugin';

export interface IR {
    readonly op: string;
    readonly args: any[];
}

function getType(dataset: any): string {
    const keys = Object.keys(dataset);
    if(keys.length != 1) {
        throw Error(`Invalid input. The object should contain only one key. But the keys are ${keys}`);
    }
    return keys[0];
  }

export class RunVisitor extends vi.SimpleVisitor<IR[]> {

  platform: string;

  settings: any;

  visitJob(node: vi.JobNode, context: IR[]) {
    if(!node.job.platform || !node.job.platform.type) {
        this.platform = 'emr';
    } else {
        this.platform = node.job.platform.type;
    }

    if(!node.job.platform || !node.job.platform.settings) {
        this.settings= {};
    } else {
        this.settings  = node.job.platform.settings;
    }

    context.push({op: `platform.${this.platform}.init`, args: [this.settings]});

    const dataTypes = new Set();

    node.inputs.forEach((x) => {
        dataTypes.add(getType((<vi.InputNode>x).dataset));
    });
    node.outputs.forEach((x) => {
        dataTypes.add(getType((<vi.OutputNode>x).dataset));
    });

    dataTypes.forEach((type) => {
        context.push({op: `data.${type}.init`, args: [this.platform]});
    });

    node.outputs.map((x) => this.prepareOutput(<vi.OutputNode>x, context));

    this.visit(node, context);
  }

  private prepareOutput(node: vi.OutputNode, context: IR[]) {
    const type = getType(node.dataset);
    context.push({op: `data.${type}.import`, args: [this.platform, node.dataset]});
  }

  visitInput(node: vi.InputNode, context: IR[]) {
    const type = getType(node.dataset);
    context.push({op: `data.${type}.import`, args: [this.platform, node.dataset]});
  }

  visitOutput(node: vi.OutputNode, context: IR[]) {
    const type = getType(node.dataset);
    context.push({op: `data.${type}.export`, args: [this.platform, node.dataset]});
  }

  visitTask(node: vi.TaskNode, context: IR[]) {
    const type = getType(node.task);
    context.push({op: `platform.${this.platform}.task`, args: [type, node.task]});
  }
}
