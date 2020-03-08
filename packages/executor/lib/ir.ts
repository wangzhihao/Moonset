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
    MetastoreSync,
    MetastoreSyncBack,
    Asset,
    EDXPrepare,
    EDXUpload,
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
      context.push({op: OP.MetastoreSync, node: node});
    }
    if (node.dataset.edx) {
      context.push({op: OP.EDXPrepare, node: node});
    }
    context.push({op: OP.MetricEnd, node: node});
  }

  visitInput(node: vi.InputNode, context: IR[]) {
    context.push({op: OP.MetricBegin, node: node});
    if (node.dataset.glue) {
      context.push({op: OP.MetastoreSync, node: node});
    }
    if (node.dataset.edx) {
      context.push({op: OP.EDXPrepare, node: node});
    }
    context.push({op: OP.MetricEnd, node: node});
  }

  visitOutput(node: vi.OutputNode, context: IR[]) {
    context.push({op: OP.MetricBegin, node: node});
    if (node.dataset.glue) {
      context.push({op: OP.MetastoreSyncBack, node: node});
    }
    if (node.dataset.edx) {
      context.push({op: OP.EDXUpload, node: node});
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
      context.push({op: OP.MetastoreSync, node: node});
    }
    if (node.dataset.edx) {
      context.push({op: OP.EDXPrepare, node: node});
    }
  }

  visitInput(node: vi.InputNode, context: IR[]) {
    if (node.dataset.glue) {
      context.push({op: OP.MetastoreSync, node: node});
    }
    if (node.dataset.edx) {
      context.push({op: OP.EDXPrepare, node: node});
    }
  }

  visitOutput(node: vi.OutputNode, context: IR[]) {
    if (node.dataset.glue) {
      context.push({op: OP.MetastoreSyncBack, node: node});
    }
    if (node.dataset.edx) {
      context.push({op: OP.EDXUpload, node: node});
    }
  }

  visitTask(node: vi.TaskNode, context: IR[]) {
    context.push({op: OP.EMRTask, node: node});
  }
}
