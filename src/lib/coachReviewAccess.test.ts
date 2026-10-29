import { describe, expect, it } from 'vitest'
import { resolveReadableReviewSubscriptionIds, resolveWritableReviewSubscription } from './coachReviewAccess'

const STUDENT = 'student-1'
const OTHER_STUDENT = 'student-2'
const COACH_USER = 'coach-user-1'
const COACH = 'coach-1'
const OTHER_COACH = 'coach-2'

const SUBSCRIPTIONS = [
  { id: 'sub-a', student_id: STUDENT, coach_id: COACH },
  { id: 'sub-b', student_id: STUDENT, coach_id: OTHER_COACH },
  { id: 'sub-c', student_id: OTHER_STUDENT, coach_id: OTHER_COACH },
]
const COACHES = [{ id: COACH, user_id: COACH_USER }]

/** 只实现被测代码用到的 select/eq/maybeSingle 链，按条件在内存数组里过滤。 */
function fakeDb() {
  const tables: Record<string, any[]> = { coach_subscriptions: SUBSCRIPTIONS, coaches: COACHES }
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      const rows = () => tables[table].filter((row) => filters.every(([key, value]) => row[key] === value))
      const builder: any = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          filters.push([key, value])
          return builder
        },
        maybeSingle: async () => ({ data: rows()[0] || null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(resolve),
      }
      return builder
    },
  }
}

describe('coach review read access', () => {
  it('never returns every review when no filter is given', async () => {
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), STUDENT, {})).resolves.toEqual({ ok: true, subscriptionIds: ['sub-a', 'sub-b'] })
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), 'stranger', {})).resolves.toEqual({ ok: true, subscriptionIds: [] })
  })

  it('lets a student read only their own subscriptions', async () => {
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), STUDENT, { studentId: STUDENT })).resolves.toEqual({ ok: true, subscriptionIds: ['sub-a', 'sub-b'] })
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), STUDENT, { studentId: OTHER_STUDENT })).resolves.toMatchObject({ ok: false, status: 403 })
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), STUDENT, { subscriptionId: 'sub-c' })).resolves.toMatchObject({ ok: false, status: 403 })
  })

  it('lets a coach read only subscriptions they own', async () => {
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), COACH_USER, { subscriptionId: 'sub-a' })).resolves.toEqual({ ok: true, subscriptionIds: ['sub-a'] })
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), COACH_USER, { subscriptionId: 'sub-b' })).resolves.toMatchObject({ ok: false, status: 403 })
    // 学员同时订阅了别的教练：这位教练只能看到自己那份订阅上的记录。
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), COACH_USER, { studentId: STUDENT })).resolves.toEqual({ ok: true, subscriptionIds: ['sub-a'] })
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), COACH_USER, { studentId: OTHER_STUDENT })).resolves.toEqual({ ok: true, subscriptionIds: [] })
    await expect(resolveReadableReviewSubscriptionIds(fakeDb(), COACH_USER, { subscriptionId: 'missing' })).resolves.toMatchObject({ ok: false, status: 404 })
  })
})

describe('coach review write access', () => {
  it('only allows the owning coach and takes ids from the subscription', async () => {
    await expect(resolveWritableReviewSubscription(fakeDb(), COACH_USER, 'sub-a')).resolves.toEqual({
      ok: true,
      subscription: { id: 'sub-a', student_id: STUDENT, coach_id: COACH },
    })
    await expect(resolveWritableReviewSubscription(fakeDb(), COACH_USER, 'sub-b')).resolves.toMatchObject({ ok: false, status: 403 })
    await expect(resolveWritableReviewSubscription(fakeDb(), STUDENT, 'sub-a')).resolves.toMatchObject({ ok: false, status: 403 })
    await expect(resolveWritableReviewSubscription(fakeDb(), COACH_USER, '')).resolves.toMatchObject({ ok: false, status: 400 })
  })
})
