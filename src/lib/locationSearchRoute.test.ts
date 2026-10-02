import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), search: vi.fn() }))
vi.mock('../app/api/auth/[...nextauth]/auth', () => ({ getServerSession: mocks.session }))
vi.mock('./globalPlaceSearch', () => ({ searchGlobalPlaces: mocks.search, PlaceSearchBusyError: class extends Error {} }))
import { POST } from '../app/api/streetlifting-index/locations/search-places/route'
afterEach(() => vi.clearAllMocks())
describe('place search route', () => {
  it('does not expose external search to unauthenticated requests', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await POST(new Request('https://coachlink.test/search', { method: 'POST', body: '{"query":"Tokyo"}' }))).status).toBe(401)
    expect(mocks.search).not.toHaveBeenCalled()
  })
  it('rejects malformed and oversized input before using the search provider', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'test-user' } })
    for (const body of ['{', JSON.stringify({ query: 'x' }), JSON.stringify({ query: 'x'.repeat(161) })]) {
      expect((await POST(new Request('https://coachlink.test/search', { method: 'POST', body }))).status).toBe(400)
    }
    expect(mocks.search).not.toHaveBeenCalled()
  })
  it('returns search candidates without creating a location', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'test-user' } })
    mocks.search.mockResolvedValue([{ name: 'Tokyo', latitude: 35.67, longitude: 139.69 }])
    const response = await POST(new Request('https://coachlink.test/search', { method: 'POST', body: JSON.stringify({ query: '  Tokyo  ' }) }))
    expect(response.status).toBe(200)
    expect((await response.json()).data[0].name).toBe('Tokyo')
    expect(mocks.search).toHaveBeenCalledWith('Tokyo')
  })
})
