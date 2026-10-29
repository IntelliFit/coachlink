-- CoachLink has no automatic (recurring) charge: students renew manually.
-- auto_renew defaulted to true and was never read, so every row looked like
-- auto-renewal was on. Turn it off and document it as unused.
alter table public.coach_subscriptions alter column auto_renew set default false;

update public.coach_subscriptions set auto_renew = false where auto_renew is distinct from false;

comment on column public.coach_subscriptions.auto_renew is
  '未使用：产品没有自动续费（不会到期自动扣款），续费由学员手动下单。保留列仅为兼容。';
