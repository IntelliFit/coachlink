import { describe, expect, it } from 'vitest'
import {
  buildConfirmRequest,
  buildDismissRequest,
  extractReceiptInfo,
  moneyYuanText,
  paymentTypeLabel,
  tierLabel,
} from '../../apps/mobile/src/screens/coach/coachPaymentModel'

const NOW = new Date('2026-10-27T08:00:00.000Z')

describe('mobile coach payment model', () => {
  it('confirms new orders through the order endpoint', () => {
    expect(buildConfirmRequest({ id: 'o1', record_kind: 'subscription_order' }, NOW))
      .toEqual({ path: '/api/subscription/confirm-subscription-order', body: { orderId: 'o1' } })
    expect(buildDismissRequest({ id: 'o1', record_kind: 'subscription_order' }, NOW))
      .toEqual({ path: '/api/subscription/update-subscription-order', body: { id: 'o1', coachSeenAt: NOW.toISOString() } })
  })

  it('extends legacy renewals from the later of now and the current end date', () => {
    const future = buildConfirmRequest({
      id: 's1',
      record_kind: 'legacy_subscription',
      subscribed_weeks: 4,
      end_date: '2026-11-10T00:00:00.000Z',
      payment_data: { pending_renew: { additional_weeks: 2 }, other: 1 },
    }, NOW)
    expect(future.path).toBe('/api/subscription/update-subscription')
    expect(future.body).toEqual({
      id: 's1',
      status: 'active',
      subscribed_weeks: 6,
      end_date: '2026-11-24T00:00:00.000Z',
      payment_data: { pending_renew: null, other: 1 },
    })

    const expired = buildConfirmRequest({ id: 's2', subscribed_weeks: 4, end_date: '2026-10-01T00:00:00.000Z', payment_data: { pending_renew: { additional_weeks: 1 } } }, NOW)
    expect(expired.body.end_date).toBe('2026-11-03T08:00:00.000Z')
  })

  it('clears an expired end date when no renewal or offline expiry is given', () => {
    expect(buildConfirmRequest({ id: 's3', end_date: '2026-10-01T00:00:00.000Z' }, NOW).body)
      .toEqual({ id: 's3', status: 'active', end_date: null })
    expect(buildConfirmRequest({ id: 's4', payment_data: { offline_payment: { expires_at: '2026-12-01T00:00:00.000Z' } } }, NOW).body.end_date)
      .toBe('2026-12-01T00:00:00.000Z')
    expect(buildDismissRequest({ id: 's4' }, NOW).body).toEqual({ id: 's4', coach_seen_at: NOW.toISOString() })
  })

  it('formats money, receipts and labels', () => {
    expect(moneyYuanText(29900)).toBe('¥299.00')
    expect(moneyYuanText(299, 'yuan')).toBe('¥299.00')
    expect(moneyYuanText(0)).toBe('')
    expect(extractReceiptInfo('已转账 付款凭证：https://img.example/r.png 谢谢')).toEqual({ cleanNote: '已转账  谢谢', receiptUrl: 'https://img.example/r.png' })
    expect(extractReceiptInfo('')).toEqual({ cleanNote: '', receiptUrl: '' })
    expect(tierLabel(3)).toBe('全能指导')
    expect(tierLabel(undefined)).toBe('特惠版')
    expect(paymentTypeLabel({ id: 'x', status: 'inactive' }, 'system')).toBe('平台待支付')
    expect(paymentTypeLabel({ id: 'x', payment_data: { offline_payment: {} } }, 'manual')).toBe('线下已支付')
  })
})
