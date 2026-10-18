-- The production subscription stores order_id as uuid and last_payment_order_id
-- as text. Resolve both metadata values using their actual column types.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create or replace function public.coach_apply_subscription_package_renewal(p_subscription_id uuid, p_source_key text,
  p_package jsonb, p_force_queue boolean, p_metadata jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  s public.coach_subscriptions%rowtype;
  q public.coach_subscription_package_queue%rowtype;
  requested_payment_id public.coach_subscriptions.order_id%type;
  requested_last_payment_id public.coach_subscriptions.last_payment_order_id%type;
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
  requested_payment_id := p_metadata->>'paymentOrderId';
  requested_last_payment_id := p_metadata->>'paymentOrderId';
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
    order_id = coalesce(requested_payment_id, order_id),
    last_payment_order_id = coalesce(requested_last_payment_id, last_payment_order_id),
    updated_at = clock_timestamp() where id = s.id returning * into s;
  return jsonb_build_object('subscription', to_jsonb(s), 'queued', false, 'applied', true);
end;
$$;
revoke all on function public.coach_apply_subscription_package_renewal(uuid,text,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.coach_apply_subscription_package_renewal(uuid,text,jsonb,boolean,jsonb) to service_role;
commit;
