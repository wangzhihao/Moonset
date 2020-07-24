import {EmrSdkPlatformPlugin} from './emr-sdk-plugin';
import {EmrStepFunctionPlatformPlugin} from './emr-sf-plugin';

export const plugins = [
  new EmrSdkPlatformPlugin(),
  new EmrStepFunctionPlatformPlugin(),
];

export * from './constants';
