import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import {PluginHost as CdkPluginHost} from 'aws-cdk';

export interface DataPlugin {

  version: '1';

  plugin: 'data';

  type: string;

  init: (host: PluginHost, platform: string) => void;

  import: (host: PluginHost, platform: string, data: any) => void;

  export: (host: PluginHost, platform: string, data: any) => void;
}

export interface PlatformPlugin {

  version: '1';

  plugin: 'platform';
      
  type: string;

  init: (host: PluginHost) => void;

  task: (host: PluginHost, type: string, task: any) => Promise<any>;

  run: (host: PluginHost) => Promise<any>;
}

export interface Hook {
    fn: Function;
    thisArg: any;
}

export class PluginHost {
  static instance = new PluginHost();

  readonly hooks: { [key: string]: Hook; } = {};
  readonly plugins: string[] = [];
  readonly cdkPlugins: string[] = [];
  constructs: { [key: string]: any; } = {}; //TODO: too open
  platformPlugins: { [key: string]: any; } = {}; //TODO: too open

  id: string;

  session: string;

  platform: string;

  settings: any;

  constructor() {
    if (PluginHost.instance && PluginHost.instance !== this) {
      throw new Error('New instances of PluginHost must not be built. Use PluginHost.instance instead!');
    }
  }

  /**
   * Loads a plug-in into this PluginHost.
   *
   * @param moduleSpec the specification (path or name) of the plug-in module to be loaded.
   */
  public load(moduleSpec: string) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const pluginModule = require(moduleSpec);
      /* eslint-enable */
      pluginModule.plugins.forEach((plugin: any) => {
      if (isDataPlugin(plugin)) {
          this.hooks[`data.${plugin.type}.init`] = {fn: plugin.init, thisArg: plugin};
          this.hooks[`data.${plugin.type}.import`] = {fn: plugin.import, thisArg: plugin};
          this.hooks[`data.${plugin.type}.export`] = {fn: plugin.export, thisArg: plugin};
          this.plugins.push(moduleSpec);
      } else if (isPlatformPlugin(plugin)) {
          this.hooks[`platform.${plugin.type}.init`] = {fn: plugin.init, thisArg: plugin};
          this.hooks[`platform.${plugin.type}.task`] = {fn: plugin.task, thisArg: plugin};
          this.hooks[`platform.${plugin.type}.run`] = {fn: plugin.run, thisArg: plugin};
          this.plugins.push(moduleSpec);
          this.platformPlugins[plugin.type] = plugin;
      } else {
          // TODO CDK plugins feature is broken.
          CdkPluginHost.instance.load(moduleSpec);
          this.cdkPlugins.push(moduleSpec);
      }
      })
    function isDataPlugin(x: any): x is DataPlugin {
      return x != null && x.plugin === 'data' && x.version === '1';
    }
    function isPlatformPlugin(x: any): x is PlatformPlugin {
      return x != null && x.plugin === 'platform' && x.version === '1';
    }
  }
}
