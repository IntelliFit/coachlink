-- Paid packages are separate from the current entitlement until it is exhausted.
begin;
create table public.coach_subscription_package_queue (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.coach_subscriptions(id),
  source_key text not null unique,
  product_id text not null,
  product_name text not null,
  product_tier text not null,
  tier integer not null check (tier in (1,2,3)),
  amount_fen integer not null check (amount_fen > 0),
  purchased_weeks integer not null check (purchased_weeks > 0),
  subscribe_data jsonb,
  payment_method text,
  payment_confirmed_by text,
  payment_order_id uuid,
  status text not null default 'queued' check (status in ('queued','active','completed','cancelled','renewed')),
  created_at timestamptz not null default clock_timestamp(),
  activated_at timestamptz
);
create index on public.coach_subscription_package_queue(subscription_id, status, created_at, id);
alter table public.coach_subscription_package_queue enable row level security;
revoke all on public.coach_subscription_package_queue from public, anon, authenticated;
grant all on public.coach_subscription_package_queue to service_role;

create function public.coach_enqueue_subscription_package(p_subscription_id uuid, p_source_key text, p_package jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  s public.coach_subscriptions%rowtype;
  q public.coach_subscription_package_queue%rowtype;
begin
  select * into strict s from public.coach_subscriptions where id = p_subscription_id for update;
  select * into q from public.coach_subscription_package_queue where source_key = p_source_key;
  if found then
    if q.subscription_id <> p_subscription_id then raise exception 'source order belongs to another subscription'; end if;
    return to_jsonb(q);
  end if;
  if nullif(p_source_key, '') is null or nullif(p_package->>'productId', '') is null then
    raise exception 'missing source order or product';
  end if;
  insert into public.coach_subscription_package_queue
    (subscription_id, source_key, product_id, product_name, product_tier, tier, amount_fen, purchased_weeks, subscribe_data,
     payment_method, payment_confirmed_by, payment_order_id)
  values (p_subscription_id, p_source_key, p_package->>'productId', p_package->>'productName', p_package->>'productTier',
    (p_package->>'tier')::integer, (p_package->>'amountFen')::integer, (p_package->>'purchasedWeeks')::integer,
    nullif(p_package->'subscribeData', 'null'::jsonb), p_package->'paymentMetadata'->>'paymentMethod',
    p_package->'paymentMetadata'->>'confirmedBy', (p_package->'paymentMetadata'->>'paymentOrderId')::uuid) returning * into q;
  update public.coach_subscriptions set payment_data = coalesce(payment_data, '{}'::jsonb) ||
    jsonb_build_object('pending_package_switch', true), updated_at = clock_timestamp() where id = s.id;
  return to_jsonb(q);
end;
$$;

-- The server uses the existing service-week calculator before calling this RPC.
-- The row lock + expected snapshot prevents a concurrent renewal from being lost.
create function public.coach_activate_subscription_package(p_subscription_id uuid, p_expected_weeks numeric, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  s public.coach_subscriptions%rowtype;
  q public.coach_subscription_package_queue%rowtype;
  activated_time timestamptz := clock_timestamp();
  source_status text;
  source_payment_id uuid;
begin
  select * into strict s from public.coach_subscriptions where id = p_subscription_id for update;
  if coalesce(s.subscribed_weeks, 0) <> p_expected_weeks or s.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('activated', false);
  end if;
  if exists (select 1 from public.plan_instance_executions e join public.coach_plan_instances i on i.id = e.instance_id
    where i.coach_subscription_id = s.id and e.status = 'in_progress') then
    return jsonb_build_object('activated', false);
  end if;
  for q in select * from public.coach_subscription_package_queue where subscription_id = s.id and status = 'queued'
    order by created_at, id for update loop
    source_status := null;
    if split_part(q.source_key, ':', 1) = 'payment' then
      select status into source_status from public.alipay_orders where id = split_part(q.source_key, ':', 2)::uuid for share;
    elsif split_part(q.source_key, ':', 1) = 'subscription_order' then
      select status, alipay_order_id into source_status, source_payment_id from public.coach_subscription_orders
        where id = split_part(q.source_key, ':', 2)::uuid for share;
      if source_payment_id is not null then
        select status into source_status from public.alipay_orders where id = source_payment_id for share;
      end if;
    end if;
    if source_status in ('refunded', 'cancelled', 'closed', 'failed') then
      update public.coach_subscription_package_queue set status = 'cancelled' where id = q.id;
      continue;
    end if;
    if source_status is distinct from 'paid' then return jsonb_build_object('activated', false); end if;
    exit;
  end loop;
  if q.id is null or q.status <> 'queued' or source_status is distinct from 'paid' then
    return jsonb_build_object('activated', false);
  end if;
  -- Archive definitions; execution snapshots, PRs, videos and feedback stay intact.
  update public.coach_plan_instances set status = 'archived', archive_reason = 'served_phase', updated_at = activated_time
    where coach_subscription_id = s.id and status in ('active','paused','completed','scheduled');
  update public.coach_subscription_package_queue set status = 'completed' where subscription_id = s.id and status = 'active';
  update public.coach_subscription_package_queue set status = 'active', activated_at = activated_time where id = q.id returning * into q;
  update public.coach_subscriptions set status = 'active', product_id = q.product_id, product_name = q.product_name,
    product_tier = q.product_tier, tier = q.tier, monthly_price = q.amount_fen,
    subscribed_weeks = coalesce(s.subscribed_weeks, 0) + q.purchased_weeks,
    subscribe_data = coalesce(q.subscribe_data, s.subscribe_data), end_date = null,
    payment_method = coalesce(q.payment_method, s.payment_method),
    payment_confirmed_by = coalesce(q.payment_confirmed_by, 'system'), payment_confirmed_at = q.created_at,
    order_id = q.payment_order_id, last_payment_order_id = q.payment_order_id, coach_seen_at = null,
    payment_data = coalesce(s.payment_data, '{}'::jsonb) || jsonb_build_object(
      'pending_package_switch', exists(select 1 from public.coach_subscription_package_queue where subscription_id = s.id and status = 'queued'),
      'current_package_activation', jsonb_build_object('id', q.id, 'activated_at', activated_time, 'source_key', q.source_key)),
    updated_at = activated_time where id = s.id returning * into s;
  return jsonb_build_object('activated', true, 'subscription', to_jsonb(s), 'package', to_jsonb(q));
end;
$$;

revoke all on function public.coach_enqueue_subscription_package(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.coach_activate_subscription_package(uuid,numeric,timestamptz) from public, anon, authenticated;
grant execute on function public.coach_enqueue_subscription_package(uuid,text,jsonb) to service_role;
grant execute on function public.coach_activate_subscription_package(uuid,numeric,timestamptz) to service_role;

-- Renewals and switches share the subscription lock, so a renewal cannot
-- overwrite an activation or lose a paid package after a delayed callback.
create function public.coach_apply_subscription_package_renewal(p_subscription_id uuid, p_source_key text,
  p_package jsonb, p_force_queue boolean, p_metadata jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.coach_subscriptions%rowtype; q public.coach_subscription_package_queue%rowtype;
begin
  select * into strict s from public.coach_subscriptions where id = p_subscription_id for update;
  select * into q from public.coach_subscription_package_queue where source_key = p_source_key;
  if found then
    if q.subscription_id <> s.id then raise exception 'source order belongs to another subscription'; end if;
    return jsonb_build_object('subscription', to_jsonb(s), 'queued', q.status = 'queued', 'applied', false);
  end if;
  if p_force_queue or (p_package->>'productId') is distinct from s.product_id then
    perform public.coach_enqueue_subscription_package(s.id, p_source_key, p_package || jsonb_build_object('paymentMetadata', p_metadata));
    select * into s from public.coach_subscriptions where id = s.id;
    return jsonb_build_object('subscription', to_jsonb(s), 'queued', true, 'applied', true);
  end if;
  insert into public.coach_subscription_package_queue
    (subscription_id, source_key, product_id, product_name, product_tier, tier, amount_fen, purchased_weeks, status)
  values (s.id, p_source_key, p_package->>'productId', p_package->>'productName', p_package->>'productTier',
    (p_package->>'tier')::integer, (p_package->>'amountFen')::integer, (p_package->>'purchasedWeeks')::integer, 'renewed');
  update public.coach_subscriptions set status = 'active', subscribed_weeks = coalesce(s.subscribed_weeks,0) + (p_package->>'purchasedWeeks')::integer,
    payment_data = coalesce(s.payment_data,'{}'::jsonb) || coalesce(p_metadata->'paymentData','{}'::jsonb),
    payment_method = coalesce(p_metadata->>'paymentMethod', payment_method),
    payment_confirmed_by = coalesce(p_metadata->>'confirmedBy', payment_confirmed_by),
    payment_confirmed_at = clock_timestamp(),
    coach_seen_at = case when p_metadata->>'confirmedBy' = 'system' then null else clock_timestamp() end,
    order_id = coalesce((p_metadata->>'paymentOrderId')::uuid, order_id),
    last_payment_order_id = coalesce((p_metadata->>'paymentOrderId')::uuid, last_payment_order_id),
    updated_at = clock_timestamp() where id = s.id returning * into s;
  return jsonb_build_object('subscription', to_jsonb(s), 'queued', false, 'applied', true);
end;
$$;
revoke all on function public.coach_apply_subscription_package_renewal(uuid,text,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.coach_apply_subscription_package_renewal(uuid,text,jsonb,boolean,jsonb) to service_role;
commit;
