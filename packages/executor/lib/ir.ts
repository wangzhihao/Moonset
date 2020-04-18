import * as vi from './visitor';

export interface IR {
    readonly op: OP;
    readonly node: vi.Node;
}

export interface IR2 {
    readonly op: string;
    readonly node: vi.Node;
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


export class RunVisitor extends vi.SimpleVisitor<IR2[]> {
  visitJob(node: vi.JobNode, context: IR2[]) {
    context.push({op: `emr.setup`, node: node});
    node.outputs.map((x) => this.prepareOutput(<vi.OutputNode>x, context));
    this.visit(node, context);
  }

  private prepareOutput(node: vi.OutputNode, context: IR2[]) {
    const type = this.getType(node.dataset);
    context.push({op: `data.${type}.import.to.emr`, node: node});
  }

  private getType(dataset: any): string {
    const keys = Object.keys(dataset);
    if(keys.length != 1) {
        throw Error(`Invalid input. The object should contain only one key. But the keys are ${keys}`);
    }
    return keys[0];
  }

  visitInput(node: vi.InputNode, context: IR2[]) {
    const type = this.getType(node.dataset);
    context.push({op: `data.${type}.import.to.emr`, node: node});
  }

  visitOutput(node: vi.OutputNode, context: IR2[]) {
    const type = this.getType(node.dataset);
    context.push({op: `data.${type}.export.from.emr`, node: node});
  }

  visitTask(node: vi.TaskNode, context: IR2[]) {
    const type = this.getType(node.task);
    context.push({op: `task.${type}.execute.on.emr`, node: node});
  }
}
