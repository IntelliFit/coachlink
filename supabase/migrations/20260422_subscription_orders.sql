-- 拆分“待支付/待确认订单”和“正式订阅”：
-- coach_subscription_orders 记录下单、待支付、待教练确认、已支付等订单事实；
-- coach_subscriptions 只保留正式生效的订阅事实。

create table if not exists public.coach_subscription_orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  subscription_id uuid null references public.coach_subscriptions(id) on delete set null,
  order_type text not null check (order_type in ('subscribe', 'renew')),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'pending_confirmation', 'paid', 'cancelled')),
  payment_method text null,
  amount_fen integer not null default 0,
  tier integer not null check (tier in (1, 2, 3)),
  product_id text null,
  product_name text null,
  product_tier text null,
  purchased_weeks integer null,
  subscribe_data jsonb null,
  note text null,
  payment_data jsonb not null default '{}'::jsonb,
  payment_confirmed_by text null,
  payment_confirmed_at timestamptz null,
  coach_seen_at timestamptz null,
  alipay_order_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coach_subscription_orders is '教练订阅订单：记录下单、待支付、待确认、已支付等订单事实，不承载正式订阅状态';
comment on column public.coach_subscription_orders.amount_fen is '本次订单金额（单位：分）';
comment on column public.coach_subscription_orders.subscribe_data is '下单时的问卷/订阅资料快照，仅首单订阅使用';
comment on column public.coach_subscription_orders.payment_data is '支付补充数据，如线下凭证、扫码备注等';

create index if not exists idx_subscription_orders_student on public.coach_subscription_orders(student_id);
create index if not exists idx_subscription_orders_coach on public.coach_subscription_orders(coach_id);
create index if not exists idx_subscription_orders_status on public.coach_subscription_orders(status);
create index if not exists idx_subscription_orders_subscription on public.coach_subscription_orders(subscription_id);
create index if not exists idx_subscription_orders_paid_unseen
  on public.coach_subscription_orders (coach_id, coach_seen_at)
  where status = 'paid' and payment_confirmed_by = 'system' and coach_seen_at is null;

drop trigger if exists coach_subscription_orders_set_updated_at on public.coach_subscription_orders;
create trigger coach_subscription_orders_set_updated_at
before update on public.coach_subscription_orders
for each row execute function public.set_updated_at();

alter table public.coach_subscription_orders enable row level security;

create policy "Students can view own subscription orders"
on public.coach_subscription_orders
for select
to authenticated
using ((auth.uid())::text = (student_id)::text);

create policy "Students can insert own subscription orders"
on public.coach_subscription_orders
for insert
to authenticated
with check ((auth.uid())::text = (student_id)::text);

create policy "Students can update own subscription orders"
on public.coach_subscription_orders
for update
to authenticated
using ((auth.uid())::text = (student_id)::text)
with check ((auth.uid())::text = (student_id)::text);

create policy "Coaches can view own subscription orders"
on public.coach_subscription_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.coaches
    where coaches.id = coach_subscription_orders.coach_id
      and (coaches.user_id)::text = (auth.uid())::text
  )
);

grant all on table public.coach_subscription_orders to anon;
grant all on table public.coach_subscription_orders to authenticated;
grant all on table public.coach_subscription_orders to service_role;
