-- Migration: 20260106_student_membership_system
-- Description: Implement Student Membership System tables (Memberships, quotas, orders, coupons, wallets, referrals)

-- 1. Student Memberships Table
create table if not exists public.student_memberships (
  user_id uuid primary key references public.users(id) on delete cascade,
  tier text not null check (tier in ('free', 'basic', 'premium', 'trial')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  status text not null check (status in ('active', 'expired')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.student_memberships is 'Tracks platform membership status for students';

-- 2. Student Quotas Table
create table if not exists public.student_quotas (
  user_id uuid primary key references public.users(id) on delete cascade,
  ai_import_balance int default 0,
  storage_total_mb int default 0,
  storage_used_mb int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.student_quotas is 'Tracks usage quotas and balances for students';

-- 3. Student Coupons Table (Created before orders to allow FK)
create table if not exists public.student_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text not null check (type in ('discount_cash', 'duration_gift')),
  value numeric not null,
  condition_min_amount numeric default 0,
  category_limit text,
  status text check (status in ('unused', 'used', 'expired')) default 'unused',
  expires_at timestamptz,
  created_at timestamptz default now(),
  used_at timestamptz
);

comment on table public.student_coupons is 'Discount coupons and gift cards for students';

-- 4. Student Membership Orders Table
create table if not exists public.student_membership_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  product_key text not null,
  amount numeric not null,
  original_amount numeric not null,
  coupon_id uuid references public.student_coupons(id) on delete set null,
  payment_method text check (payment_method in ('alipay', 'wechat')),
  status text check (status in ('pending', 'paid', 'cancelled')) default 'pending',
  created_at timestamptz default now(),
  paid_at timestamptz
);

comment on table public.student_membership_orders is 'Payment records for platform memberships and addon packs';

-- 5. Coach Wallets Table
create table if not exists public.coach_wallets (
  coach_id uuid primary key references public.coaches(id) on delete cascade,
  balance numeric default 0,
  total_income numeric default 0,
  frozen_amount numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.coach_wallets is 'Financial wallet for coaches to track earnings and withdrawals';

-- 6. Wallet Transactions Table
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references public.coach_wallets(coach_id) on delete cascade,
  amount numeric not null,
  type text not null check (type in ('income', 'withdrawal', 'refund')),
  related_order_id uuid, -- Can reference different order tables, so kept generic
  description text,
  created_at timestamptz default now()
);

comment on table public.wallet_transactions is 'Transaction history for coach wallets';

-- 7. Payout Requests Table
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches(id) on delete cascade,
  amount numeric not null,
  alipay_account text not null,
  real_name text not null,
  status text check (status in ('pending', 'processing', 'paid', 'rejected')) default 'pending',
  paid_at timestamptz,
  transaction_no text,
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.payout_requests is 'Withdrawal requests from coaches';

-- 8. Referral Rewards Table
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid references public.users(id) on delete set null,
  invitee_id uuid references public.users(id) on delete set null,
  status text check (status in ('pending', 'completed')) default 'pending',
  reward_granted jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.referral_rewards is 'Tracking referrals and rewards';

-- 9. Promotion Submissions Table
create table if not exists public.promotion_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  platform text not null,
  video_url text not null,
  view_count int default 0,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  admin_feedback text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.promotion_submissions is 'User submissions for promotional rewards (e.g. social media posts)';

-- Indexes for performance
create index idx_student_memberships_status on public.student_memberships(status);
create index idx_student_membership_orders_user on public.student_membership_orders(user_id);
create index idx_student_membership_orders_status on public.student_membership_orders(status);
create index idx_student_coupons_user on public.student_coupons(user_id);
create index idx_student_coupons_status on public.student_coupons(status);
create index idx_wallet_transactions_wallet on public.wallet_transactions(wallet_id);
create index idx_payout_requests_coach on public.payout_requests(coach_id);
create index idx_payout_requests_status on public.payout_requests(status);
create index idx_referral_rewards_inviter on public.referral_rewards(inviter_id);
create index idx_promotion_submissions_user on public.promotion_submissions(user_id);
create index idx_promotion_submissions_status on public.promotion_submissions(status);
