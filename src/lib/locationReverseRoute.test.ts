import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), reverse: vi.fn() }))
vi.mock('../app/api/auth/[...nextauth]/auth', () => ({ getServerSession: mocks.session }))
vi.mock('./globalPlaceSearch', () => ({ searchGlobalPlaces: vi.fn(), reverseGlobalPlace: mocks.reverse, PlaceSearchBusyError: class extends Error {} }))
import { POST } from '../app/api/streetlifting-index/locations/search-places/route'
afterEach(() => vi.clearAllMocks())
const request = (body: unknown) => new Request('https://coachlink.test/search', { method: 'POST', body: JSON.stringify(body) })
describe('reverse lookup API boundary', () => {
  it('requires login before lookup', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await POST(request({ mode: 'reverse', latitude: 35, longitude: 139 }))).status).toBe(401)
    expect(mocks.reverse).not.toHaveBeenCalled()
  })
  it('rejects nonnumeric and out-of-range points, but accepts zero', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'tester' } })
    for (const latitude of ['35', 91, null]) expect((await POST(request({ mode: 'reverse', latitude, longitude: 139 }))).status).toBe(400)
    mocks.reverse.mockResolvedValue([])
    expect((await POST(request({ mode: 'reverse', latitude: 0, longitude: 0 }))).status).toBe(200)
    expect(mocks.reverse).toHaveBeenCalledTimes(1)
  })
})
