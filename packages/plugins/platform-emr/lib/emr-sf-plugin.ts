import {ConfigConstant as CC, CDKResourceReader, logger} from '@moonset/util';
import {ISDK, SDKProvider, S3AssetUploader} from '@moonset/util';
import {CommonConstants as C} from '@moonset/util';
import {PluginHost} from '@moonset/executor';
import {RequestGenerator} from './request-generator';
import {Platform, EMRConstants as EC} from './constants';
import {CDKResourceManager} from './cdk-resource-manager';

const states: any[] = [];

/**
 * Use Step Function to manage EMR. It's useful to setup scheduled jobs.
 */
export const EmrStepFunctionPlatformPlugin = {
  version: '1',
  plugin: 'platform',
  type: Platform.EMR_STEP_FUNCTION,
  states: states,

  init(host: PluginHost) {
    new CDKResourceManager(host, Platform.EMR_STEP_FUNCTION).setup();
  },

  async task(host: PluginHost, type: string, task: any) {
    const sdk = await SDKProvider.forWorkingAccount();
    const resources = new CDKResourceReader(host.session, sdk);
    const generator = new RequestGenerator(host, Platform.EMR_STEP_FUNCTION, resources);

    const state = {
      Name: type,
      Parameters: {
        'ClusterId.$': '$.EmrSettings.ClusterId',
        Step: await generator.getStepConfig(type, task),
      },
      Type: 'Task',
      Resource: 'arn:aws:states:::elasticmapreduce:addStep.sync',
      // Passthrough input to output in AWS Step Functions https://stackoverflow.com/a/47651570
      ResultPath: null
    };
    states.push(state);
  },

  async run(host: PluginHost) {
    const sdk = await SDKProvider.forWorkingAccount();
    // For now we only have working account's cdk resources.
    const resources = new CDKResourceReader(host.session, sdk);
    const stepfunctions = sdk.stepfunctions();
    const generator = new RequestGenerator(host, Platform.EMR_STEP_FUNCTION, resources);

    const s1 = {
      Name: 'CreateEMR',
      Parameters: await generator.getRunJobFlowInput(),
      Type: 'Task',
      Resource: 'arn:aws:states:::elasticmapreduce:createCluster.sync',
      ResultPath: '$.EmrSettings',
    };
    states.unshift(s1);

    const s2 = {
      Name: 'TerminateEMR',
      Parameters: {
        'ClusterId.$': '$.EmrSettings.ClusterId',
      },
      Type: 'Task',
      Resource: 'arn:aws:states:::elasticmapreduce:terminateCluster.sync',
      ResultPath: null
    };
    states.push(s2);

    const params = {
      definition: JSON.stringify(getDefinition()),
      name: `MoonsetStepFunction-${host.session}-${host.id}`,
      roleArn: (await resources.findRole(EC.TAG_MOONSET_TYPE_SF_ROLE)).Arn!,
      tags: [
        {key: C.MOONSET_SESSION, value: host.session},
        {key: C.MOONSET_ID, value: host.id},
        {key: C.TAG_MOONSET_TYPE, value: EC.TAG_MOONSET_TYPE_STEP_FUNCTION},
      ],
      type: 'STANDARD',
    };
    logger.info(`Step Function will be created with params: ${JSON.stringify(params)}.`);
    await stepfunctions.createStateMachine(params).promise();
  },
};

function getDefinition() {
  const definition = {States: {}};
  for (let i = 0; i < states.length; i++) {
    const taskName = `Task-${i}-${states[i].Name}`;

    definition.States[taskName] = states[i];
    delete definition.States[taskName].Name;

    if (i == 0) {
      definition['StartAt'] = taskName;
    }
    if (i == states.length - 1) {
      definition.States[taskName]['End'] = true;
    } else {
      const nextTaskName = `Task-${i+1}-${states[i+1].Name}`;
      definition.States[taskName]['Next'] = nextTaskName;
    }
  }
  return definition;
}
