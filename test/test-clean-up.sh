#!/bin/bash
set -euo pipefail
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

yes | npx cdk --app ./build/cdk.out destroy '*'

echo "Pass!"
