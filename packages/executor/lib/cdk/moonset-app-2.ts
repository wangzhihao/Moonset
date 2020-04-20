import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as sfnTasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import {MoonsetConstants as MC} from '../constants';
import {MetastoreSyncConstruct} from './metastore-sync';
import * as ir from '../ir';
// eslint-disable-next-line
import * as vi from '../visitor';
import * as plugin from '../plugin';
import {StringAsset, FileAsset} from './asset';
import * as path from 'path';
import {Config, ConfigConstant as CC, Serde} from '@moonset/util';

function main() {
    const commands = Serde.fromFile<ir.IR2[]>(
        path.join(MC.BUILD_TMP_DIR, MC.MOONSET_PROPS));

    plugin.PluginHost.instance.constructs[MC.CDK_APP] = new cdk.App();

    commands.forEach((command) => {
        const fn = plugin.PluginHost.instance.hooks[command.op];
        fn(...command.args);
    });

    (<cdk.App>plugin.PluginHost.instance.constructs[MC.CDK_APP]).synth();
}

main();
