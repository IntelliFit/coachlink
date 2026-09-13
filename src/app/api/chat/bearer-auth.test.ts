import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
    getServerSession: vi.fn(),
    verifyToken: vi.fn(),
}))
const databaseMocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('next-auth', () => ({ getServerSession: authMocks.getServerSession }))
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }))
vi.mock('@/lib/jwt', () => ({ verifyToken: authMocks.verifyToken }))
vi.mock('@/lib/supabaseClient', () => ({
    default: { from: databaseMocks.from },
    serviceRoleSupabase: { from: databaseMocks.from },
}))
vi.mock('@/lib/cos', () => ({
    buildDatedKey: vi.fn(() => 'test/image.jpg'),
    cosUpload: vi.fn(),
}))

function bearerRequest(path: string, body: unknown = {}) {
    return new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer mobile-token', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('chat mobile bearer authentication', () => {
    beforeEach(() => {
        authMocks.getServerSession.mockReset().mockResolvedValue(null)
        authMocks.verifyToken.mockReset().mockReturnValue({ userId: 'mobile-user' })
        databaseMocks.from.mockReset()
    })

    it.each([
        ['create room', '/api/chat/create-chatroom', () => import('./create-chatroom/route')],
        ['get room', '/api/chat/get-chatroom', () => import('./get-chatroom/route')],
        ['list messages', '/api/chat/list-messages', () => import('./list-messages/route')],
        ['send message', '/api/chat/send-message', () => import('./send-message/route')],
        ['mark read', '/api/chat/mark-as-read', () => import('./mark-as-read/route')],
        ['search messages', '/api/chat/search-messages', () => import('./search-messages/route')],
    ])('accepts bearer before validating %s input', async (_name, path, loadRoute) => {
        const { POST } = await loadRoute()
        const response = await POST(bearerRequest(path) as never)

        expect(response.status).toBe(400)
        expect(authMocks.verifyToken).toHaveBeenCalledWith('mobile-token')
    }, 20_000)

    it('accepts bearer authentication for chat image multipart upload', async () => {
        const { POST } = await import('../upload/chat-image/route')
        const response = await POST(new Request('http://localhost/api/upload/chat-image', {
            method: 'POST',
            headers: { Authorization: 'Bearer mobile-token' },
            body: new FormData(),
        }))

        expect(response.status).toBe(400)
        expect(authMocks.verifyToken).toHaveBeenCalledWith('mobile-token')
    }, 60_000)

    it('rejects an invalid bearer before reading chat data', async () => {
        authMocks.verifyToken.mockReturnValue(null)
        const { POST } = await import('./mark-as-read/route')
        const response = await POST(bearerRequest('/api/chat/mark-as-read'))
        expect(response.status).toBe(401)
    })
})
