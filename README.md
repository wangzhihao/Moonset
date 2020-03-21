<p align="center">
  <img alt="moonset" src="https://raw.githubusercontent.com/FBAChinaOpenSource/Moonset/master/images/moonset.jpg" width="480">
</p>

# Moonset

Moonset is a data processing framework on top of AWS. It provides both batch
processing and stream processing. Try command:

```
npx moonset --help
```

For example, to run some hive tasks on AWS EMR. Try to following command.

```bash
# config the credentials
npx moonset config

# run a job
npx moonset deploy --job '{
    "input": [{
        "glue": { "db": "foo", "table": "apple", "partition": {"region_id": "1", "snapshot_date": "2020-01-01"}}
    },{
        "glue": { "db": "foo", "table": "orange", "partition": {"region_id": "1", "snapshot_date": "2020-01-01"}}
    }],
    "task": [{
        "hive": {"sqlFile": "s3://foo/hive.sql"}
    }],
    "output": [{
        "glue": { "db": "foo", "table": "pineapple", "partition": {"region_id": "1", "snapshot_date": "2020-01-01"}}
    }]
}'

```

All resources is managed by AWS CDK so there is minimum effort for
infrastructure setup. You can run it in a brand new account.

The EMR is created in a VPC's private subnet, You can connect to both master
and slave nodes via AWS Session Manager. No ssh key pair or bastion is needed.
Follow [this guide](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html)
to start a session to connect to EMR's instances.

