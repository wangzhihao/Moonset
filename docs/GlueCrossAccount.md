## Glue Cross Account Support

With Moonset you can read or write glue data catalog of another **reference
account** from **working account**, with some manual configurations. 

1. Configure the s3 bucket policy in **reference account** to allow **working
   account** to access.  Here is an example to allow read only access for
   account `aaaa` to s3 bucket `foo` and prefix `tmp/*`.

```
{
    "Version": "2012-10-17",
    "Id": "Policy1588933754831",
    "Statement": [
        {
            "Sid": "MoonsetS3ResourceSharing",
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "aaaa"
                ]
            },
            "Action": [
                "s3:Get*",
                "s3:List*"
            ],
            "Resource": "arn:aws:s3:::foo/tmp/*"
        },
        {
            "Sid": "MoonsetS3BucketSharing",
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "aaaa"
                ]
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::foo",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "tmp/*"
                }
            }
        }
    ]
}
```

2. Create an IAM Role with AWSGlueServiceRole managed policy in **reference
   account**, and set the trusted entity to be **working account**.

3. Launch an EMR with the IAM Role in step 2. Here is an example:

```
npx moonset run \
    --plugin '@moonset/plugin-platform-emr'  \
    --plugin '@moonset/plugin-data-glue' \
    --job '{
    "input": [{
        "glue": { 
          "db": "foo", "table": "apple", 
          "assumeRole": "arn:aws:iam::734326032173:role/MoonsetGlueAccess",
          partition": {"region_id": "1", "snapshot_date": "2020-01-01"}
        }
    }],
    "task": [{
        "hive": {"sql": "select * from foo.table limit 100;"}
    }]
}'
```
