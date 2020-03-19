#!/bin/bash

curl -LO https://github.com/FBAChinaOpenSource/MoonsetMetastoreSync/releases/download/v0.0.1/MoonsetMetastoreSync.jar

java -cp MoonsetMetastoreSync.jar:/usr/lib/hive/lib/*:/usr/lib/hive/auxlib/*:/usr/lib/hadoop/*:/usr/lib/hadoop-mapreduce/*:/usr/share/aws/aws-java-sdk/* moonset.metastore.sync.tools.DataCatalogSyncTool "$@"
