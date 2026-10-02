// Runs entirely in a disposable local PostgreSQL container. Never loads project env.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const container = `coachlink-global-locations-check-${process.pid}-${Date.now()}`;
const schema = fs.readFileSync(path.join(root, 'supabase/migrations/20260128_streetlifting_index.sql'), 'utf8');
const base = schema.match(/create table if not exists public\.streetlifting_locations \([\s\S]*?\n\);/i)?.[0];
if (!base) throw new Error('Original location schema was not found');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261002175648_streetlifting_locations_global.sql'), 'utf8');
const sql = `begin;
${base}
insert into public.streetlifting_locations(name,latitude,longitude) values ('legacy',39.9,116.4);
${migration}
insert into public.streetlifting_locations(name,country,city,latitude,longitude,coordinate_system) values
('London pull-up bar','英国','London',51.5074,-0.1278,'wgs84'),
('Sydney pull-up bar','澳大利亚','Sydney',-33.8688,151.2093,'wgs84'),
('Seoul pull-up bar','韩国','Seoul',37.5665,126.978,'wgs84');
do $$ begin
if (select count(*) from public.streetlifting_locations where country='英国' and longitude<0)<>1 then raise exception 'country/negative longitude failed'; end if;
if (select count(*) from public.streetlifting_locations where country='澳大利亚' and latitude<0)<>1 then raise exception 'negative latitude failed'; end if;
if (select count(*) from public.streetlifting_locations where country is null and coordinate_system is null)<>1 then raise exception 'legacy migration compatibility failed'; end if;
end $$;
update public.streetlifting_locations set description='updated overseas point' where country='英国';
do $$ begin
if (select count(*) from public.streetlifting_locations where description='updated overseas point')<>1 then raise exception 'update failed'; end if;
end $$;
delete from public.streetlifting_locations where country is not null;
do $$ begin
if (select count(*) from public.streetlifting_locations)<>1 then raise exception 'cleanup failed'; end if;
end $$;
rollback;
select count(*) as residual_tables from information_schema.tables where table_name='streetlifting_locations';`;
let created = false;
try {
  execFileSync('docker', ['run', '-d', '--pull=never', '--name', container, '--rm', '-e', 'POSTGRES_PASSWORD=local-verification-only', 'docker.m.daocloud.io/postgres:17-alpine'], { stdio: 'ignore' });
  created = true;
  const deadline = Date.now() + 20000;
  while (true) {
    try { execFileSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }); break; }
    catch (error) { if (Date.now() > deadline) throw error; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200); }
  }
  const output = execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
  console.log(output);
} finally {
  if (created) execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
}
