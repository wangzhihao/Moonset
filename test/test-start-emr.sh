#!/bin/bash
set -euo pipefail
scriptdir=$(cd $(dirname $0) && pwd)
cd ${scriptdir}

echo "Integration Test: Start an EMR."

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

aws emr list-clusters --region us-east-1 --active | grep Moonset

if [ $? -ne 0 ]; then
  echo 'No EMR is started by Moonset'
  exit 1
fi

echo "Pass!"
