// eslint-disable-next-line
import * as model from '@moonset/model';

export abstract class Visitor<R, C> {
    abstract visit(node: Node, context: C): R;

    visitRoot(root: RootNode, context: C): R {
      return this.visit(root, context);
    }
    visitJob(job: JobNode, context: C): R {
      return this.visit(job, context);
    }
    visitInput(input: InputNode, context: C): R {
      return this.visit(input, context);
    }
    visitOutput(output: OutputNode, context: C): R {
      return this.visit(output, context);
    }
    visitTask(task: TaskNode, context: C): R {
      return this.visit(task, context);
    }
}

export class SimpleVisitor<C> extends Visitor<void, C> {
  visit(node: Node, context: C) {
    for (const child of node.getChildren()) {
      child.accept(this, context);
    }
  }
}

export abstract class Node {
  accept<R, C>(visitor: Visitor<R, C>, context: C): R {
    return visitor.visit(this, context);
  }

    abstract getChildren(): Node[];
}


export class RootNode extends Node {
    jobs: model.IJob[];

    nodes: Node[];

    constructor(properties: model.IJob[]) {
      super();
      this.jobs = properties;
      this.nodes = this.jobs.map((x) => new JobNode(x));
    }

    accept<R, C>(visitor: Visitor<R, C>, context: C): R {
      return visitor.visitRoot(this, context);
    }

    getChildren(): Node[] {
      return this.nodes;
    }
}
export class JobNode extends Node {
    job: model.IJob;

    inputs: Node[];
    outputs: Node[];
    tasks: Node[];

    constructor(properties: model.IJob) {
      super();
      this.job = properties;
      this.inputs =
        this.job.input ? this.job.input.map((x) => new InputNode(x)) : [];
      this.outputs =
        this.job.output ? this.job.output.map((x) => new OutputNode(x)) : [];
      this.tasks =
        this.job.task ? this.job.task.map((x) => new TaskNode(x)) : [];
    }

    accept<R, C>(visitor: Visitor<R, C>, context: C): R {
      return visitor.visitJob(this, context);
    }

    getChildren(): Node[] {
      const array: Node[] = [];
      return array.concat(this.inputs, this.tasks, this.outputs);
    }
}

export class InputNode extends Node {
    dataset: model.IDataSet;

    constructor(properties: model.IDataSet) {
      super();
      this.dataset = properties;
    }

    accept<R, C>(visitor: Visitor<R, C>, context: C): R {
      return visitor.visitInput(this, context);
    }

    getChildren(): Node[] {
      return <Node[]>[];
    }
}

export class OutputNode extends Node {
    dataset: model.IDataSet;

    constructor(properties: model.IDataSet) {
      super();
      this.dataset = properties;
    }


    accept<R, C>(visitor: Visitor<R, C>, context: C): R {
      return visitor.visitOutput(this, context);
    }
    getChildren(): Node[] {
      return <Node[]>[];
    }
}

export class TaskNode extends Node {
    task: model.ITask;

    constructor(properties: model.ITask) {
      super();
      this.task= properties;
    }

    accept<R, C>(visitor: Visitor<R, C>, context: C): R {
      return visitor.visitTask(this, context);
    }

    getChildren(): Node[] {
      return <Node[]>[];
    }
}
