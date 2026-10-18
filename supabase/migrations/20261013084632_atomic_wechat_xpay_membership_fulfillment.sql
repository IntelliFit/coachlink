begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

-- A private-to-service receipt survives retries and concurrent delivery.
create table if not exists public.wechat_xpay_fulfillments (
  env integer not null check (env in (0,1)),
  out_trade_no text not null,
  payment_id uuid not null,
  membership_order_id uuid not null,
  user_id uuid not null,
  product_key text not null,
  granted_at timestamptz not null default now(),
  primary key (env,out_trade_no),
  unique (membership_order_id)
);
alter table public.wechat_xpay_fulfillments enable row level security;
revoke all on public.wechat_xpay_fulfillments from public,anon,authenticated;
grant select,insert on public.wechat_xpay_fulfillments to service_role;

-- Invoker, not definer: only the trusted payment server may call this.
-- Caller MUST first verify the signed WeChat event or fresh WeChat query.
create or replace function public.fulfill_wechat_xpay_membership(p_payment_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare
  p public.alipay_orders%rowtype;
  m public.student_membership_orders%rowtype;
  existing public.wechat_xpay_fulfillments%rowtype;
  tier_name text;
  expected_fen bigint;
  expected_sku text;
  granted boolean;
begin
  select * into strict p from public.alipay_orders where id=p_payment_id for update;
  if p.payment_provider is distinct from 'wechat_xpay' or p.status is distinct from 'paid'
    or p.order_type is distinct from 'student_membership' or (p.order_data->>'xpay_admin_trial')='true'
    or p.user_id is null then raise exception 'Unverified XPay membership order'; end if;
  select * into strict m from public.student_membership_orders
    where id=(p.order_data->>'related_order_id')::uuid for update;
  if m.user_id is distinct from p.user_id or m.product_key is distinct from p.order_data->>'product_key'
    or m.amount is distinct from p.total_amount then raise exception 'XPay membership order mismatch'; end if;
  case m.product_key
    when 'monthly_basic' then expected_fen:=1990;expected_sku:='m_basic_1990';
    when 'monthly_premium' then expected_fen:=3990;expected_sku:='m_premium_3990';
    when 'ai_pack_basic' then expected_fen:=200;expected_sku:='ai_pack_200';
    when 'storage_pack_basic' then expected_fen:=990;expected_sku:='storage_990';
    else raise exception 'Unknown XPay product';
  end case;
  if p.total_amount is distinct from expected_fen or p.order_data->>'xpay_product_id' is distinct from expected_sku
    or p.order_data->>'xpay_out_trade_no' is null then raise exception 'XPay product price mismatch'; end if;
  insert into public.wechat_xpay_fulfillments(env,out_trade_no,payment_id,membership_order_id,user_id,product_key)
    values ((p.order_data->>'xpay_env')::integer,p.order_data->>'xpay_out_trade_no',p.id,m.id,p.user_id,m.product_key)
    on conflict (env,out_trade_no) do nothing returning true into granted;
  if not coalesce(granted,false) then
    select * into strict existing from public.wechat_xpay_fulfillments
      where env=(p.order_data->>'xpay_env')::integer and out_trade_no=p.order_data->>'xpay_out_trade_no';
    if existing.membership_order_id <> m.id or existing.user_id <> p.user_id or existing.product_key <> m.product_key
      then raise exception 'XPay receipt ownership mismatch'; end if;
    return false;
  end if;
  if m.status is distinct from 'pending' then raise exception 'Membership requires manual fulfillment review'; end if;
  insert into public.student_quotas(user_id,ai_import_balance,storage_total_mb,storage_used_mb)
    values (p.user_id,0,500,0) on conflict(user_id) do nothing;
  perform 1 from public.student_quotas where user_id=p.user_id for update;
  if m.product_key='ai_pack_basic' then
    update public.student_quotas set ai_import_balance=coalesce(ai_import_balance,0)+3,updated_at=now() where user_id=p.user_id;
  elsif m.product_key='storage_pack_basic' then
    update public.student_quotas set storage_total_mb=coalesce(storage_total_mb,0)+1024,updated_at=now() where user_id=p.user_id;
  else
    tier_name:=case when m.product_key='monthly_premium' then 'premium' else 'basic' end;
    insert into public.student_memberships(user_id,tier,start_date,end_date,status)
      values (p.user_id,tier_name,now(),now()+interval '30 days','active')
      on conflict(user_id) do update set
        start_date=case when student_memberships.status='active' and student_memberships.tier=excluded.tier
          and student_memberships.end_date>now() then student_memberships.start_date else now() end,
        end_date=case when student_memberships.status='active' and student_memberships.tier=excluded.tier
          and student_memberships.end_date>now() then student_memberships.end_date+interval '30 days' else now()+interval '30 days' end,
        tier=excluded.tier,status='active',updated_at=now();
    update public.student_quotas set ai_import_balance=case when tier_name='premium' then 9999 else 10 end,
      storage_total_mb=case when tier_name='premium' then 5120 else 1024 end,updated_at=now() where user_id=p.user_id;
  end if;
  update public.student_membership_orders set status='paid',paid_at=now() where id=m.id;
  return true;
end;
$$;
revoke all on function public.fulfill_wechat_xpay_membership(uuid) from public,anon,authenticated;
grant execute on function public.fulfill_wechat_xpay_membership(uuid) to service_role;
commit;
