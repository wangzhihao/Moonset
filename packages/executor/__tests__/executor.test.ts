import {Executor} from '../lib';

const job = `{
    "task": [ {"hive": {"sqlFile": "s3://foo/hive.sql"}} ],
    "platform": {"type": "emr", "settings": {}}
}`;

describe('Intermediate Representation:', () => {
  test('The sample job should have 2 micro commands.', () => {
    const states = new Executor().ir(job);
    // expect(states.length).toEqual(2);
  });
});
