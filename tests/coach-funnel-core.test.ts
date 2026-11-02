import { describe, expect, it } from 'vitest'
import {
  COACH_EXIT_CANDIDATE_TTL_MS,
  COACH_EXIT_COOLDOWN_MS,
  COACH_EXIT_MIN_DWELL_MS,
  COACH_EXIT_PAYMENT_COOLDOWN_MS,
  buildCoachExitCandidate,
  coachExitReasonLabel,
  coachExitReasonsFor,
  isCoachExitReason,
  isCoachFunnelEvent,
  shouldAskCoachExitReason,
  type CoachExitCandidate
} from '@coachlink/core/src/coachFunnel'

const NOW = 1_800_000_000_000

function candidate(overrides: Partial<CoachExitCandidate> = {}): CoachExitCandidate {
  return { coachId: 'coach-1', coachName: '教练', leftAt: NOW, trigger: 'list_return', ...overrides }
}

describe('buildCoachExitCandidate', () => {
  const base = { coachId: 'coach-1', coachName: '教练', enteredAt: NOW - COACH_EXIT_MIN_DWELL_MS, now: NOW }

  it('records a visitor who stayed long enough and has no subscription', () => {
    expect(buildCoachExitCandidate(base)).toMatchObject({ coachId: 'coach-1', leftAt: NOW, trigger: 'list_return' })
  })

  it('ignores an accidental tap', () => {
    expect(buildCoachExitCandidate({ ...base, enteredAt: NOW - COACH_EXIT_MIN_DWELL_MS + 1 })).toBeNull()
  })

  it.each(['active', 'expired', 'near_expiry', 'waiting'])('does not ask a %s student why they did not subscribe', (status) => {
    expect(buildCoachExitCandidate({ ...base, subscriptionStatus: status })).toBeNull()
  })

  it('still asks someone who left an unpaid subscription behind', () => {
    expect(buildCoachExitCandidate({ ...base, subscriptionStatus: 'inactive' })).not.toBeNull()
  })

  it('does not ask a coach about their own page', () => {
    expect(buildCoachExitCandidate({ ...base, isOwnProfile: true })).toBeNull()
  })

  it('needs a coach id', () => {
    expect(buildCoachExitCandidate({ ...base, coachId: '' })).toBeNull()
  })
})

describe('shouldAskCoachExitReason', () => {
  it('asks right after leaving when never asked before', () => {
    expect(shouldAskCoachExitReason({ candidate: candidate(), now: NOW + 1000 })).toBe(true)
  })

  it('does not ask without a candidate', () => {
    expect(shouldAskCoachExitReason({ candidate: null, now: NOW })).toBe(false)
  })

  it('drops a stale candidate', () => {
    expect(shouldAskCoachExitReason({ candidate: candidate(), now: NOW + COACH_EXIT_CANDIDATE_TTL_MS + 1 })).toBe(false)
  })

  it('waits out the cooldown after the last question', () => {
    const asked = NOW - COACH_EXIT_COOLDOWN_MS + 1000
    expect(shouldAskCoachExitReason({ candidate: candidate(), now: NOW, lastAskedAt: asked })).toBe(false)
    expect(shouldAskCoachExitReason({ candidate: candidate(), now: NOW, lastAskedAt: NOW - COACH_EXIT_COOLDOWN_MS })).toBe(true)
  })

  it('uses the shorter cooldown after a cancelled payment', () => {
    const paid = candidate({ trigger: 'payment_cancel' })
    expect(shouldAskCoachExitReason({ candidate: paid, now: NOW, lastAskedAt: NOW - COACH_EXIT_PAYMENT_COOLDOWN_MS })).toBe(true)
    expect(shouldAskCoachExitReason({ candidate: paid, now: NOW, lastAskedAt: NOW - COACH_EXIT_PAYMENT_COOLDOWN_MS + 1000 })).toBe(false)
  })
})

describe('coachExitReasonsFor', () => {
  const values = (canBuy?: boolean) => coachExitReasonsFor(canBuy).map((reason) => reason.value)

  it('hides "cannot buy" for a coach who can sell', () => {
    expect(values(true)).not.toContain('cannot_buy')
    expect(values(true)).toContain('price')
  })

  it('hides price and payment for a coach who cannot sell', () => {
    expect(values(false)).toContain('cannot_buy')
    expect(values(false)).not.toContain('price')
    expect(values(false)).not.toContain('payment_issue')
  })

  it('shows everything when it is unknown, with "other" last', () => {
    expect(values()).toContain('cannot_buy')
    expect(values()).toContain('price')
    expect(values().at(-1)).toBe('other')
  })
})

describe('validators', () => {
  it('accepts only known events and reasons', () => {
    expect(isCoachFunnelEvent('profile_view')).toBe(true)
    expect(isCoachFunnelEvent('drop_table')).toBe(false)
    expect(isCoachExitReason('price')).toBe(true)
    expect(isCoachExitReason('nope')).toBe(false)
    expect(isCoachExitReason(undefined)).toBe(false)
  })

  it('labels reasons, falling back to the raw value', () => {
    expect(coachExitReasonLabel('price')).toBe('价格不合适')
    expect(coachExitReasonLabel('legacy')).toBe('legacy')
  })
})
