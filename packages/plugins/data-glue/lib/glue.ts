// eslint-disable-next-line
import * as cdk from '@aws-cdk/core';
import {PluginHost, MoonsetConstants as MC} from '@moonset/executor';
import {MetastoreSyncConstruct} from './metstore-sync';

let index = 0;

export = {
  version: '1',
  plugin: 'data',
  type: 'glue',

  init(host: PluginHost, platform: string) {
    if (platform !== 'emr') {
      throw Error('Data plugin glue currently only support emr platform.');
    }
  },

  import(host: PluginHost, platform: string, data: any) {
    if (platform !== 'emr') {
      throw Error('Data plugin glue currently only support emr platform.');
    }
    const c = host.constructs;
    const task = new MetastoreSyncConstruct(
              <cdk.Stack>c[MC.SF_STACK], `MetastoreSync-${index++}`, {
                db: data.glue.db!,
                table: data.glue.table!,
                source: 'datacatalog',
                partition: data.glue.partition!,
              }).task;
    host.commands.push(task);
  },

  export(host: PluginHost, platform: string, data: any) {
    if (platform !== 'emr') {
      throw Error('Data plugin glue currently only support emr platform.');
    }
    const c = host.constructs;
    const task = new MetastoreSyncConstruct(
              <cdk.Stack>c[MC.SF_STACK], `MetastoreSync-${index++}`, {
                db: data.glue.db!,
                table: data.glue.table!,
                source: 'hive',
                partition: data.glue.partition!,
              }).task;
    host.commands.push(task);
  },
}

