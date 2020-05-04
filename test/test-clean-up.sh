#!/bin/bash
set -eu
scriptdir=$(cd $(dirname $0) && pwd)
cd ${scriptdir}

echo "Integration Test: Cleanup Moonset Resources."

cd ../
npm install
npx lerna bootstrap
cd ./packages/cli/
npm run cli -- run  \
    --plugin $(readlink -f ../plugins/platform-emr/)  \
    --plugin $(readlink -f ../plugins/data-glue/)  \
    --job  '{"task": [
        {"hive": {"sql": "show tables;"}}
    ]}'

sleep 5s
id=$(aws emr list-clusters --region us-east-1 --active |  jq '.Clusters[].Id' | tr -d '"')
aws emr terminate-clusters --region us-east-1 --cluster-ids $id

# Command `yes` conflict with `set -o pipefail`.
#
# When pipefail is set, no matter which component of a pipe have non-zero status
# code, it will preserve and cause the whole command fail.
#
# This is the case of `yes` command. For example:
# zsh> yes | ls
# foo  
# zsh> echo "${pipestatus[1]} ${pipestatus[2]}"
# 141 0
yes | npx cdk --app ./build/cdk.out destroy '*'

echo "Pass!"
