import * as vi from './visitor';
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

  readonly platform = 'emr';

  visitJob(node: vi.JobNode, context: IR[]) {
    context.push({op: `platform.${this.platform}.init`, args: []});

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
