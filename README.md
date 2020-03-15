<p align="center">
  <img alt="moonset" src="https://raw.githubusercontent.com/wangzhihao/Moonset/second/images/moonset.jpg" width="480">
</p>

# Moonset

Moonset is a data processing framework on top of AWS. It provides both batch
processing and stream processing. Try command:

```
npx moonset --help
```

For example, to run some hive tasks on AWS EMR. Try to following command.

```
export AWS_ACCESS_KEY_ID= <...>
export AWS_SECRET_ACCESS_KEY= <...>


npx moonset deploy --job '{
    "input": [
      {"glue": { "dbName": "foo", "tableName": "apple"}}
    ],
    "task": [
      {"hive": {"sqlFile": "s3://foo/hive.sql"}}
    ],
    "output": [
      {"glue": { "dbName": "foo", "tableName": "orange"}}
    ]
}' 

```

All resources is managed by AWS CDK so there is minimum effort for
infrastructure setup. You can run it in a brand new account.
