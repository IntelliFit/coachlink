import { yuanToFen } from '@/lib/moneyUtils';

/** Orders for the same subscription created within this window are treated as a double submit. */
export const PAYMENT_DUPLICATE_WINDOW_MS = 5000;

export const RENEW_PACKAGE_REQUIRED_MESSAGE = '请选择要续费的套餐';
export const RENEW_PRICE_CHANGED_MESSAGE = '套餐价格或时长已变更，请刷新后重新选择';
export const PAYMENT_DUPLICATE_MESSAGE = '支付单正在创建，请勿重复点击';

/**
 * Renewals must be priced from the coach's package list on the server.
 * Only the dev-only test payment may renew without naming a package.
 */
export function getRenewRequestError(input: {
    renew: boolean;
    productId?: string | null;
    renewAdditionalWeeks: number;
    isTestPayment: boolean;
}): string | null {
    if (!input.renew) return null;
    if (!Number.isFinite(input.renewAdditionalWeeks) || input.renewAdditionalWeeks <= 0) return '续费周数无效';
    if (input.isTestPayment) return null;
    if (!String(input.productId || '').trim()) return RENEW_PACKAGE_REQUIRED_MESSAGE;
    return null;
}

export function getRenewPurchaseMismatch(
    purchase: { purchasedWeeks: number; amountFen: number },
    request: { renewAdditionalWeeks: number; amountYuan?: number | null },
): string | null {
    const amountYuan = Number(request.amountYuan);
    if (!Number.isFinite(amountYuan) || amountYuan <= 0) return RENEW_PRICE_CHANGED_MESSAGE;
    if (purchase.purchasedWeeks !== request.renewAdditionalWeeks) return RENEW_PRICE_CHANGED_MESSAGE;
    if (purchase.amountFen !== yuanToFen(amountYuan)) return RENEW_PRICE_CHANGED_MESSAGE;
    return null;
}

export function isRecentPendingOrder(createdAt: string, nowMs: number = Date.now()): boolean {
    const createdMs = Date.parse(createdAt);
    if (!Number.isFinite(createdMs)) return false;
    return nowMs - createdMs < PAYMENT_DUPLICATE_WINDOW_MS;
}
