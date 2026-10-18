import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn(), order: vi.fn() }))
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: { from: db.from } }))

import { POST } from '../app/api/streetlifting-index/stats/route'

const baseLocation = {
  created_at: '2020-01-01T00:00:00Z', description: null,
  province: '北京市', city: '北京市', latitude: 39.9, longitude: 116.4,
  image_url: null, image_urls: null,
}

function prepareLocations(rows: typeof baseLocation[], failFrom?: number) {
  db.range.mockImplementation((from: number, to: number) => Promise.resolve(
    from === failFrom
      ? { data: null, error: { message: 'later page unavailable' } }
      : { data: rows.slice(from, to + 1), error: null },
  ))
  db.order.mockReturnValue({ range: db.range })
  db.from.mockImplementation((table: string) => {
    if (table === 'streetlifting_locations') return { select: () => ({ order: db.order }) }
    if (table === 'streetlifting_formulas') return { select: () => ({
      order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
    }) }
    return { select: () => Promise.resolve({ count: table === 'streetlifting_submissions' ? 42 : 217, error: null }) }
  })
}

function request() {
  return new Request('https://example.test/api/streetlifting-index/stats', {
    method: 'POST', body: '{}', headers: { 'content-type': 'application/json' },
  })
}

describe('complete location overview statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T08:00:00Z'))
  })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('includes counts and coverage from points beyond the first 1000 rows', async () => {
    const rows = Array.from({ length: 1126 }, (_, index) => index < 1000 ? { ...baseLocation } : {
      ...baseLocation, created_at: '2026-10-01T00:00:00Z', description: '有双杠',
      province: 'California', city: 'Los Angeles', latitude: index === 1125 ? null : 34,
      image_urls: ['https://example.test/a.jpg', 'https://example.test/b.jpg'],
    })
    prepareLocations(rows)
    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.totalCount).toBe(42) // The unrelated submission metric keeps its meaning.
    expect(body.data.locationOverview).toMatchObject({
      totalCount: 1126, mapReadyCount: 1125, withImagesCount: 126,
      withDescriptionCount: 126, averageImageCount: 0.2, provinceCount: 2, contributorCount: 217,
    })
    expect(body.data.locationOverview.topProvinces).toContainEqual({ name: 'California', count: 126 })
    expect(body.data.locationOverview.topCities).toContainEqual({ name: 'Los Angeles', count: 126 })
    expect(body.data.locationOverview.recentMonths).toContainEqual({ month: '2026-10', count: 126 })
    expect(db.range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]])
    expect(db.order).toHaveBeenCalledWith('id', { ascending: true })
  })

  it('finishes when the inventory is an exact multiple of the batch size', async () => {
    prepareLocations(Array.from({ length: 1000 }, () => ({ ...baseLocation })))
    const body = await (await POST(request())).json()
    expect(body.data.locationOverview.totalCount).toBe(1000)
    expect(db.range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]])
  })

  it('returns zero metrics for an empty inventory', async () => {
    prepareLocations([])
    const body = await (await POST(request())).json()
    expect(body.data.locationOverview).toMatchObject({
      totalCount: 0, mapReadyCount: 0, withImagesCount: 0, withDescriptionCount: 0, averageImageCount: 0,
    })
    expect(db.range).toHaveBeenCalledTimes(1)
  })

  it('does not report a partial inventory as successful when a later page fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prepareLocations(Array.from({ length: 1126 }, () => ({ ...baseLocation })), 1000)
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ success: false, data: null })
  })
})
