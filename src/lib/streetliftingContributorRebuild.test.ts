import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn(), order: vi.fn() }))
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: { from: db.from } }))

import { readAllStreetliftingLocationsForContributors } from '../app/api/streetlifting-index/locations/contributorStats'

describe('contributor leaderboard rebuild source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const total = 1203
    db.range.mockImplementation((from: number, to: number) => Promise.resolve({
      data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, index) => ({ id: String(from + index), created_at: null, user_contact: null, contributor_user_id: `u${from + index}` })),
      error: null,
    }))
    db.order.mockReturnValue({ range: db.range })
    db.from.mockReturnValue({ select: () => ({ order: db.order }) })
  })

  it('reads every location past the 1000-row API cap, ordered by id', async () => {
    const rows = await readAllStreetliftingLocationsForContributors()
    expect(rows).toHaveLength(1203)
    expect(rows.at(-1)?.contributor_user_id).toBe('u1202')
    expect(db.order).toHaveBeenCalledWith('id', { ascending: true })
    expect(db.range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]])
  })

  it('surfaces read errors instead of rebuilding from partial data', async () => {
    db.range.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(readAllStreetliftingLocationsForContributors()).rejects.toThrow('boom')
  })
})
