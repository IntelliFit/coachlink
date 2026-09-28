// Usage: node scripts/test-plan-completion-dates.mjs <isolated-postgres-container>
// Never reads application credentials or connects to the business database.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const container = process.argv[2];
if (!/^coachlink-plan-date-test-[a-z0-9-]+$/.test(container || '')) throw new Error('An explicitly named disposable test container is required');
const database = `completion_dates_${Date.now()}`;
const run = (sql, db = database) => new Promise((resolve, reject) => {
  const child = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db], { windowsHide: true });
  let output = '';
  child.stdout.on('data', data => output += data);
  child.stderr.on('data', data => output += data);
  child.on('error', reject);
  child.on('close', code => resolve({ code, output }));
  child.stdin.end(sql);
});
const checked = async (sql, db) => { const result = await run(sql, db); assert.equal(result.code, 0, result.output); console.log(result.output.trim()); };
try {
  await checked(`create database ${database};`, 'postgres');
  for (const file of ['tests/sql/plan-completion-date-fixture.sql', 'supabase/migrations/20260925203825_plan_completion_dates.sql', 'tests/sql/plan-completion-date-assertions.sql']) {
    await checked(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  const raceSql = `set role service_role; select id from public.record_plan_completion_date(
    '10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',1,
    '2026-09-10',null,null,gen_random_uuid(),1);`;
  const raced = await Promise.all([run(raceSql), run(raceSql)]);
  assert.equal(raced.filter(r => r.code === 0).length, 1, JSON.stringify(raced));
  assert(raced.find(r => r.code !== 0).output.includes('EXECUTION_WRITE_CONFLICT'));
  await checked(`do $$ begin
    assert (select count(*) from public.plan_instance_executions where instance_id='10000000-0000-4000-8000-000000000002')=1;
    assert (select count(*) from public.plan_execution_date_confirmations a join public.plan_instance_executions e on e.id=a.execution_id where e.instance_id='10000000-0000-4000-8000-000000000002')=1;
  end $$;`);
  console.log('PASS: concurrent independent writers -> exactly one completion and one audit');
} finally {
  await checked(`drop database if exists ${database} with (force);`, 'postgres');
  console.log('CLEAN: isolated fixture database removed');
}
