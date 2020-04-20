import * as vi from './visitor';

export interface IR {
    readonly op: OP;
    readonly node: vi.Node;
}

export interface IR2 {
    readonly op: string;
    readonly args: any[];
}

/*eslint-disable */
export enum OP {
    EMRTask,
    MetricBegin,
    MetricEnd,
    InputMetastoreSync,
    OutputMetastoreSync,
    OutputMetastoreSyncBack,
    Asset,
}
/* eslint-enable */


export class DeployVisitor extends vi.SimpleVisitor<IR[]> {
  visitRoot(node: vi.RootNode, context: IR[]) {
    context.push({op: OP.MetricBegin, node: node});
    this.visit(node, context);
    context.push({op: OP.MetricEnd, node: node});
  }

  visitJob(node: vi.JobNode, context: IR[]) {
    context.push({op: OP.MetricBegin, node: node});
    node.outputs.map((x) => this.prepareOutput(<vi.OutputNode>x, context));
    this.visit(node, context);
    context.push({op: OP.MetricEnd, node: node});
  }

  private prepareOutput(node: vi.OutputNode, context: IR[]) {
    context.push({op: OP.MetricBegin, node: node});
    if (node.dataset.glue) {
      context.push({op: OP.OutputMetastoreSync, node: node});
    }
    context.push({op: OP.MetricEnd, node: node});
  }

  visitInput(node: vi.InputNode, context: IR[]) {
    context.push({op: OP.MetricBegin, node: node});
    if (node.dataset.glue) {
      context.push({op: OP.InputMetastoreSync, node: node});
    }
    context.push({op: OP.MetricEnd, node: node});
  }

  visitOutput(node: vi.OutputNode, context: IR[]) {
    context.push({op: OP.MetricBegin, node: node});
    if (node.dataset.glue) {
      context.push({op: OP.OutputMetastoreSyncBack, node: node});
    }
    context.push({op: OP.MetricEnd, node: node});
  }

  visitTask(node: vi.TaskNode, context: IR[]) {
    context.push({op: OP.MetricBegin, node: node});
    context.push({op: OP.EMRTask, node: node});
    context.push({op: OP.MetricEnd, node: node});
  }
}



function getType(dataset: any): string {
    const keys = Object.keys(dataset);
    if(keys.length != 1) {
        throw Error(`Invalid input. The object should contain only one key. But the keys are ${keys}`);
    }
    return keys[0];
  }

export class RunVisitor extends vi.SimpleVisitor<IR2[]> {

  readonly platform = 'emr';

  visitJob(node: vi.JobNode, context: IR2[]) {
    context.push({op: `platform.${this.platform}.init`, args: []});

    const dataTypes = new Set();

    node.inputs.forEach((x) => {
        dataTypes.add(getType((<vi.InputNode>x).dataset));
    });
    node.outputs.forEach((x) => {
        dataTypes.add(getType((<vi.OutputNode>x).dataset));
    });

    dataTypes.forEach((type) => {
        context.push({op: `data.${type}.init`, args: []});
    });

    node.outputs.map((x) => this.prepareOutput(<vi.OutputNode>x, context));

    this.visit(node, context);
  }

  private prepareOutput(node: vi.OutputNode, context: IR2[]) {
    const type = getType(node.dataset);
    context.push({op: `data.${type}.import`, args: [node, this.platform]});
  }

  visitInput(node: vi.InputNode, context: IR2[]) {
    const type = getType(node.dataset);
    context.push({op: `data.${type}.import`, args: [node, this.platform]});
  }

  visitOutput(node: vi.OutputNode, context: IR2[]) {
    const type = getType(node.dataset);
    context.push({op: `data.${type}.export`, args: [node, this.platform]});
  }

  visitTask(node: vi.TaskNode, context: IR2[]) {
    const type = getType(node.task);
    context.push({op: `platform.${this.platform}.execute`, args: [node, type]});
  }
}
