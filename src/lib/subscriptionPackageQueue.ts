import { serviceRoleSupabase } from '@/lib/supabaseClient';
import { getSubscriptionCarryoverSummary } from '@/lib/subscriptionCarryover';
import { yuanToFen } from '@/lib/moneyUtils';
import type { Product } from '@/app/api/coach/get-pricing/entity';

export const PACKAGE_QUEUE_TABLE = 'coach_subscription_package_queue';
export const PACKAGE_SWITCH_POLICY = 'after_current' as const;

export type PackagePurchase = {
  productId: string;
  productName: string;
  productTier: string;
  tier: number;
  amountFen: number;
  purchasedWeeks: number;
  months: number;
};

export function resolvePackagePurchase(products: Product[], productId: string, months: number): PackagePurchase {
  const product = products.find(item => item.id === productId);
  const option = product?.duration_options?.find(item => item.months === months);
  const tier = product?.tier === 'basic' ? 1 : product?.tier === 'standard' ? 2 : product?.tier === 'vip' ? 3 : 0;
  if (!product || !tier || !Number.isInteger(months) || months <= 0 || !option || !Number.isFinite(option.price) || option.price <= 0) {
    throw new Error('所选套餐或时长已变更，请刷新价格后重试');
  }
  return { productId: product.id, productName: product.name, productTier: product.tier, tier,
    amountFen: yuanToFen(option.price), purchasedWeeks: months * 4, months };
}

export async function getPackagePurchase(coachId: string, productId: string, months: number) {
  const { data, error } = await serviceRoleSupabase.from('coach_pricing').select('products').eq('coach_id', coachId).maybeSingle();
  if (error) throw new Error('暂时无法核对套餐价格，请稍后重试');
  return resolvePackagePurchase(Array.isArray(data?.products) ? data.products as unknown as Product[] : [], productId, months);
}

export async function assertPackageQueueAvailable() {
  const { error } = await (serviceRoleSupabase as any).from(PACKAGE_QUEUE_TABLE).select('id').limit(1);
  if (error) throw new Error('换套餐服务尚未就绪，请稍后重试或联系教练');
}

export async function enqueuePaidPackage(params: {
  subscriptionId: string; sourceKey: string; purchase: PackagePurchase; subscribeData?: unknown;
}) {
  const { data, error } = await (serviceRoleSupabase as any).rpc('coach_enqueue_subscription_package', {
    p_subscription_id: params.subscriptionId,
    p_source_key: params.sourceKey,
    p_package: { ...params.purchase, subscribeData: params.subscribeData ?? null },
  });
  if (error) throw new Error(`登记待生效套餐失败: ${error.message}`);
  return data;
}

export async function applyPaidPackageRenewal(params: {
  subscriptionId: string; sourceKey: string; purchase: PackagePurchase; forceQueue?: boolean;
  subscribeData?: unknown; metadata?: Record<string, unknown>; requireQueueSupport?: boolean;
}) {
  const { data, error } = await (serviceRoleSupabase as any).rpc('coach_apply_subscription_package_renewal', {
    p_subscription_id: params.subscriptionId, p_source_key: params.sourceKey,
    p_package: { ...params.purchase, subscribeData: params.subscribeData ?? null },
    p_force_queue: params.forceQueue === true, p_metadata: params.metadata || {},
  });
  if (error) {
    // Existing same-package clients still work before this migration is installed.
    if (!params.requireQueueSupport && !params.forceQueue && ['PGRST202', '42883'].includes(error.code)) return null;
    throw new Error(`确认套餐权益失败: ${error.message}`);
  }
  return data;
}

export async function activateQueuedPackageIfReady(subscriptionId: string) {
  const client = serviceRoleSupabase as any;
  const { data: subscription, error } = await client.from('coach_subscriptions').select('*').eq('id', subscriptionId).maybeSingle();
  if (error) throw new Error('无法核对待生效套餐');
  if (!subscription?.payment_data?.pending_package_switch) return { activated: false, subscription };
  const carryover = await getSubscriptionCarryoverSummary({ subscriptionId,
    subscribedWeeks: Number(subscription.subscribed_weeks || 0), subscriptionStartDate: subscription.start_date });
  if (!carryover.exhausted) return { activated: false, subscription };
  const { data: result, error: activationError } = await client.rpc('coach_activate_subscription_package', {
    p_subscription_id: subscriptionId,
    p_expected_weeks: Number(subscription.subscribed_weeks || 0),
    p_expected_updated_at: subscription.updated_at,
  });
  if (activationError) throw new Error(`套餐接续失败: ${activationError.message}`);
  if (!result?.activated) return { activated: false, subscription };
  // A different service needs its own plan; never extend or regenerate the old
  // package's plan using its old goals. Coach review is an idempotent work item.
  try {
    const { createAutomationJob, isTerminalJob, markAutomationJob } = await import('@/lib/coachingAutomation/jobs');
    const job = await createAutomationJob({ type: 'initial_plan', triggerSource: 'package_switch',
      idempotencyKey: `package_switch:${result.package.id}`, subscriptionId,
      coachId: subscription.coach_id, studentId: subscription.student_id,
      inputSnapshot: { package: result.package, reason: 'new_package_needs_plan' } });
    if (!isTerminalJob(job)) await markAutomationJob(job.id, 'needs_coach_review', {
      needsCoachConfirmation: true, outputSnapshot: { productId: result.package.product_id, productName: result.package.product_name },
    });
  } catch (error) {
    console.error('[package-switch] coach review registration deferred', error);
  }
  return { activated: true, subscription: result.subscription, package: result.package };
}

export async function getQueuedPackages(subscriptionId: string) {
  const { data, error } = await (serviceRoleSupabase as any).from(PACKAGE_QUEUE_TABLE)
    .select('id, product_id, product_name, purchased_weeks, status, created_at')
    .eq('subscription_id', subscriptionId).eq('status', 'queued').order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) throw new Error('无法读取待生效套餐');
  return data || [];
}
