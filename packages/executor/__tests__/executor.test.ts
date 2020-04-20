import {Executor} from '../lib';

const job = '{ "task": [ {"hive": {"sqlFile": "s3://foo/hive.sql"}} ] }';

describe('Intermediate Representation:', () => {
  test('The sample job should have 7 micro commands.', () => {
    const states = new Executor().ir(job);
    expect(states.length).toEqual(2);
  });
});
