export enum Platform {
    EMR_SDK = 'emr',
    EMR_STEP_FUNCTION = 'emr-sf',
}

export const EMRConstants = {
  TAG_MOONSET_TYPE_EMR: 'Emr',
  TAG_MOONSET_TYPE_STEP_FUNCTION: 'StepFunction',
  TAG_MOONSET_TYPE_SERVICE_SECURITY_GROUP: 'ServiceSecurityGroup',
  TAG_MOONSET_TYPE_EMR_EC2_ROLE: 'EmrEc2Role',
  TAG_MOONSET_TYPE_EMR_ROLE: 'EmrRole',
  TAG_MOONSET_TYPE_SF_ROLE: 'StepFunctionRole',

  EMR_STACK: 'MoonsetEmrStack',
  EMR_EC2_ROLE: 'MoonsetEmrEc2Role',
  EMR_EC2_PROFILE: 'MoonsetEmrEc2Profile',
  EMR_ROLE: 'MoonsetEmrRole',
  SF_ROLE: 'MoonsetStepFunctionRole',
};
