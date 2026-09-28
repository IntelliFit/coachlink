set role service_role;
do $$
declare
  p uuid := '10000000-0000-4000-8000-000000000001';
  u uuid := '20000000-0000-4000-8000-000000000001';
  r uuid := '30000000-0000-4000-8000-000000000001';
  e public.plan_instance_executions%rowtype;
  e2 public.plan_instance_executions%rowtype;
  stamp timestamptz;
begin
  select * into e from public.record_plan_completion_date(p,u,1,'2026-09-10',null,null,r,1);
  assert e.status='completed' and e.performed_on='2026-09-10';
  assert e.completed_at='2026-09-09T16:00:00Z'::timestamptz;
  assert e.completion_recorded_at > '2026-09-10'::timestamptz;
  assert e.action_executions='[]'::jsonb and e.completed_sets=0 and e.total_sets=0, 'fabricated sets';
  stamp := e.completion_recorded_at;
  select * into e2 from public.record_plan_completion_date(p,u,1,'2026-09-10',null,null,r,1);
  assert e2.id=e.id and (select count(*) from public.plan_execution_date_confirmations)=1, 'not idempotent';
  begin
    perform public.record_plan_completion_date(p,u,1,'2026-09-11',null,null,r,1);
    raise exception 'expected idempotency mismatch';
  exception when others then if sqlerrm <> 'REQUEST_ID_CONFLICT' then raise; end if; end;
  select * into e2 from public.record_plan_completion_date(p,u,1,'2026-09-11',e.id,e.updated_at,gen_random_uuid(),1);
  assert e2.performed_on='2026-09-11' and e2.completion_recorded_at=stamp;
  assert (select previous_completed_at=e.completed_at from public.plan_execution_date_confirmations where performed_on='2026-09-11');
  begin
    perform public.record_plan_completion_date(p,u,1,'2026-09-12',e.id,e.updated_at,gen_random_uuid(),1);
    raise exception 'expected stale version rejection';
  exception when others then if sqlerrm <> 'EXECUTION_WRITE_CONFLICT' then raise; end if; end;
  begin
    perform public.record_plan_completion_date(p,gen_random_uuid(),1,'2026-09-10',null,null,gen_random_uuid(),1);
    raise exception 'expected ownership rejection';
  exception when insufficient_privilege then null; end;
  begin
    perform public.record_plan_completion_date(p,u,2,'2026-09-10',null,null,gen_random_uuid(),1);
    raise exception 'expected rest day rejection';
  exception when others then if sqlerrm <> 'TRAINING_DAY_NOT_FOUND' then raise; end if; end;
  begin
    perform public.record_plan_completion_date(p,u,5,'2026-09-10',null,null,gen_random_uuid(),1);
    raise exception 'expected sequence rejection';
  exception when others then if sqlerrm <> 'PREVIOUS_TRAINING_UNRESOLVED' then raise; end if; end;
  begin
    perform public.record_plan_completion_date(p,u,3,'2099-01-01',null,null,gen_random_uuid(),1);
    raise exception 'expected future rejection';
  exception when others then if sqlerrm <> 'INVALID_TRAINING_DATE' then raise; end if; end;
  begin
    perform public.record_plan_completion_date(p,u,3,'2026-08-31',null,null,gen_random_uuid(),1);
    raise exception 'expected pre-plan rejection';
  exception when others then if sqlerrm <> 'INVALID_TRAINING_DATE' then raise; end if; end;
  insert into public.plan_instance_executions(instance_id,student_id,day_index,status,action_executions,total_sets,completed_sets)
    values(p,u,3,'timed_out','[{"sets":[{"actual_reps":5,"video":"keep-me"}]}]',3,2) returning * into e;
  select * into e2 from public.record_plan_completion_date(p,u,3,'2026-09-13',e.id,e.updated_at,gen_random_uuid(),1);
  assert e2.action_executions=e.action_executions and e2.completed_sets=2 and e2.total_sets=3, 'partial history changed';
  stamp := e2.completion_recorded_at;
  update public.plan_instance_executions set total_sets=4 where id=e2.id returning * into e;
  assert e.completion_recorded_at=stamp, 'ordinary edit changed submission time';
  insert into public.plan_instance_executions(instance_id,student_id,day_index,status) values(p,u,5,'timed_out') returning * into e;
  insert into public.plan_instance_executions(instance_id,student_id,day_index,status) values(p,u,5,'in_progress');
  begin
    perform public.record_plan_completion_date(p,u,5,'2026-09-15',e.id,e.updated_at,gen_random_uuid(),1);
    raise exception 'expected other attempt rejection';
  exception when others then if sqlerrm <> 'OTHER_ATTEMPT_EXISTS' then raise; end if; end;
  assert (select status='timed_out' from public.plan_instance_executions where id=e.id), 'failed command partly committed';
  raise notice 'PASS: backfill, idempotency, correction audit, stale write, ownership, date, sequence, partial-content, conflict rollback';
end $$;
reset role;
do $$ begin
  assert not has_function_privilege('anon','public.record_plan_completion_date(uuid,uuid,integer,date,uuid,timestamptz,uuid,integer)','execute');
  assert not has_function_privilege('authenticated','public.record_plan_completion_date(uuid,uuid,integer,date,uuid,timestamptz,uuid,integer)','execute');
  assert has_function_privilege('service_role','public.record_plan_completion_date(uuid,uuid,integer,date,uuid,timestamptz,uuid,integer)','execute');
  raise notice 'PASS: service-role-only RPC';
end $$;
