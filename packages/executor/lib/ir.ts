import * as vi from './visitor';

export interface IR {
    readonly op: OP;
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


export class RunVisitor extends vi.SimpleVisitor<IR[]> {
  visitJob(node: vi.JobNode, context: IR[]) {
    node.outputs.map((x) => this.prepareOutput(<vi.OutputNode>x, context));
    this.visit(node, context);
  }

  private prepareOutput(node: vi.OutputNode, context: IR[]) {
    if (node.dataset.glue) {
      context.push({op: OP.OutputMetastoreSync, node: node});
    }
  }

  visitInput(node: vi.InputNode, context: IR[]) {
    if (node.dataset.glue) {
      context.push({op: OP.InputMetastoreSync, node: node});
    }
  }

  visitOutput(node: vi.OutputNode, context: IR[]) {
    if (node.dataset.glue) {
      context.push({op: OP.OutputMetastoreSyncBack, node: node});
    }
  }

  visitTask(node: vi.TaskNode, context: IR[]) {
    context.push({op: OP.EMRTask, node: node});
  }
}
