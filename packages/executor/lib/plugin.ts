import * as cdk from '@aws-cdk/core';
import * as sfn from '@aws-cdk/aws-stepfunctions';

export interface DataPlugin {

  version: '1';

  type: string;

    init: (host: PluginHost, platform: string) => void;

  import: (host: PluginHost, platform: string, data: any) => sfn.IChainable;

  export: (host: PluginHost, platform: string, data: any) => sfn.IChainable;
}

export interface PlatformPlugin {

  version: '1';

  type: string;

  init: (host: PluginHost) => void;

  execute: (host: PluginHost, taskType: string, data: any) => sfn.IChainable;
}

export class PluginHost {
  static instance = new PluginHost();

  readonly hooks: { [key: string]: Function; } = {};
    
  app: cdk.App;

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
      const plugin = require(moduleSpec);
      /* eslint-enable */
      if (isDataPlugin(plugin)) {
          this.hooks[`data.${plugin.type}.init`] = plugin.init;
          this.hooks[`data.${plugin.type}.import`] = plugin.import;
          this.hooks[`data.${plugin.type}.export`] = plugin.export;
      } else if (isPlatformPlugin(plugin)) {
          this.hooks[`platform.${plugin.type}.init`] = plugin.init;
          this.hooks[`platform.${plugin.type}.execute`] = plugin.execute;
      } else {
        throw new Error(`Module ${moduleSpec} does not define a valid plug-in.`);
      }

    function isDataPlugin(x: any): x is DataPlugin {
      return x != null && x.version === '1';
    }
    function isPlatformPlugin(x: any): x is PlatformPlugin {
      return x != null && x.version === '1';
    }
  }
}