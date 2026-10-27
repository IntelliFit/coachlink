import { describe, expect, it } from 'vitest';
import {
    PAYMENT_DUPLICATE_WINDOW_MS,
    getRenewPurchaseMismatch,
    getRenewRequestError,
    isRecentPendingOrder,
} from './coachRenewalCheckout';

const purchase = { purchasedWeeks: 8, amountFen: 19900 };

describe('coach renewal checkout', () => {
    it('rejects a real renewal that does not name a package, whatever amount the client sends', () => {
        expect(getRenewRequestError({ renew: true, renewAdditionalWeeks: 520, isTestPayment: false })).toBe('请选择要续费的套餐');
        expect(getRenewRequestError({ renew: true, productId: '  ', renewAdditionalWeeks: 8, isTestPayment: false })).toBe('请选择要续费的套餐');
    });

    it('allows the dev-only test renewal without a package and ignores non-renewals', () => {
        expect(getRenewRequestError({ renew: true, renewAdditionalWeeks: 4, isTestPayment: true })).toBeNull();
        expect(getRenewRequestError({ renew: false, renewAdditionalWeeks: 0, isTestPayment: false })).toBeNull();
    });

    it('rejects non-positive renewal weeks', () => {
        expect(getRenewRequestError({ renew: true, productId: 'p', renewAdditionalWeeks: 0, isTestPayment: false })).toBe('续费周数无效');
    });

    it('accepts a request that matches the server price and duration', () => {
        expect(getRenewPurchaseMismatch(purchase, { renewAdditionalWeeks: 8, amountYuan: 199 })).toBeNull();
    });

    it('flags tampered or stale amount and weeks', () => {
        const message = '套餐价格或时长已变更，请刷新后重新选择';
        expect(getRenewPurchaseMismatch(purchase, { renewAdditionalWeeks: 8, amountYuan: 0.01 })).toBe(message);
        expect(getRenewPurchaseMismatch(purchase, { renewAdditionalWeeks: 520, amountYuan: 199 })).toBe(message);
        expect(getRenewPurchaseMismatch(purchase, { renewAdditionalWeeks: 8, amountYuan: undefined })).toBe(message);
    });

    it('treats a pending order for the same subscription created moments ago as a duplicate submit', () => {
        const now = Date.parse('2026-10-27T10:37:31.000Z');
        expect(isRecentPendingOrder('2026-10-27T10:37:29.600Z', now)).toBe(true);
        expect(isRecentPendingOrder(new Date(now - PAYMENT_DUPLICATE_WINDOW_MS - 1).toISOString(), now)).toBe(false);
        expect(isRecentPendingOrder('not-a-date', now)).toBe(false);
    });
});
