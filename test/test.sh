#!/bin/bash
set -euo pipefail
scriptdir=$(cd $(dirname $0) && pwd)

echo CLI Integration Tests

for test in $(cd ${scriptdir} && ls test-*.sh); do
  echo "============================================================================================"

  echo "${test}"
  echo "============================================================================================"
  /bin/bash ${scriptdir}/${test}
done
