import * as vi from './visitor';
import {PluginHost} from './plugin';

/**
 * The hook function for the plugin to integrate into.
 * Here is a sample code to invoke this hook function.
 *   const fn = PluginHost.instance.hooks[command.op];
 *   await fn(PluginHost.instance, ...command.args);
 */
export interface MicroCommand {
    readonly op: string;
    readonly args: any[];
}
/**
 * The intermediate representation of Moonset Executor.
 *
 * It contains an array of CDK commands and SDK commands. CDK commands are 
 * synchronous and SDK commands are asynchronous. CDK commands are executed and
 * deployed before SDK commands execute.
 */
export interface IR {
    readonly cdk: MicroCommand[];
    readonly sdk: MicroCommand[];
}

function getType(dataset: any): string {
    const keys = Object.keys(dataset);
    if(keys.length != 1) {
        throw Error(`Invalid input. The object should contain only one key. But the keys are ${keys}`);
    }
    return keys[0];
  }

export class RunVisitor extends vi.SimpleVisitor<IR> {

  platform: string;

  settings: any;

  visitJob(node: vi.JobNode, m: IR) {
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
    PluginHost.instance.platform = this.platform;
    PluginHost.instance.settings = this.settings;

    m.cdk.push({op: `platform.${this.platform}.init`, args: []});

    const dataTypes = new Set();

    node.inputs.forEach((x) => {
        dataTypes.add(getType((<vi.InputNode>x).dataset));
    });
    node.outputs.forEach((x) => {
        dataTypes.add(getType((<vi.OutputNode>x).dataset));
    });

    dataTypes.forEach((type) => {
        m.cdk.push({op: `data.${type}.init`, args: [this.platform]});
    });

    node.outputs.map((x) => this.prepareOutput(<vi.OutputNode>x, m));

    this.visit(node, m);

    m.sdk.push({op: `platform.${this.platform}.run`, args: []});
  }

  private prepareOutput(node: vi.OutputNode, m: IR) {
    const type = getType(node.dataset);
    m.sdk.push({op: `data.${type}.import`, args: [this.platform, node.dataset]});
  }

  visitInput(node: vi.InputNode, m: IR) {
    const type = getType(node.dataset);
    m.sdk.push({op: `data.${type}.import`, args: [this.platform, node.dataset]});
  }

  visitOutput(node: vi.OutputNode, m: IR) {
    const type = getType(node.dataset);
    m.sdk.push({op: `data.${type}.export`, args: [this.platform, node.dataset]});
  }

  visitTask(node: vi.TaskNode, m: IR) {
    const type = getType(node.task);
    m.sdk.push({op: `platform.${this.platform}.task`, args: [type, node.task]});
  }
}
