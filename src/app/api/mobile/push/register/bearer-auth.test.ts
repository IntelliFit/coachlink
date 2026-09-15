import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
    getServerSession: vi.fn(),
    verifyToken: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
    rpc: vi.fn(),
    from: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: authMocks.getServerSession }))
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }))
vi.mock('@/lib/jwt', () => ({ verifyToken: authMocks.verifyToken }))
vi.mock('@/lib/supabaseClient', () => ({
    serviceRoleSupabase: { rpc: dbMocks.rpc, from: dbMocks.from },
}))

import { DELETE, POST } from './route'

describe('mobile push registration bearer authentication', () => {
    beforeEach(() => {
        authMocks.getServerSession.mockReset().mockResolvedValue(null)
        authMocks.verifyToken.mockReset().mockReturnValue({ userId: 'mobile-user' })
        dbMocks.rpc.mockReset().mockResolvedValue({ data: 'registration-id', error: null })
        dbMocks.from.mockReset()
    })

    it('accepts bearer before validating registration input', async () => {
        const response = await POST(new Request('http://localhost/api/mobile/push/register', {
            method: 'POST',
            headers: { Authorization: 'Bearer mobile-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }))
        expect(response.status).toBe(400)
        expect(authMocks.verifyToken).toHaveBeenCalledWith('mobile-token')
    }, 15_000)

    it('does not downgrade an invalid bearer credential to a cookie session', async () => {
        authMocks.verifyToken.mockReturnValue(null)
        authMocks.getServerSession.mockResolvedValue({ user: { id: 'cookie-user' } })
        const response = await POST(new Request('http://localhost/api/mobile/push/register', {
            method: 'POST',
            headers: { Authorization: 'Bearer invalid', 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }))
        expect(response.status).toBe(401)
    })

    it('uses the atomic registration function and does not return the push token', async () => {
        const response = await POST(new Request('http://localhost/api/mobile/push/register', {
            method: 'POST',
            headers: { Authorization: 'Bearer mobile-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                installationId: 'install-1234567890',
                pushToken: 'ExpoPushToken[secret-token]',
                platform: 'ANDROID',
                permissionStatus: 'granted',
                appVersion: '1.0.0',
                deviceModel: 'Test Phone',
            }),
        }))

        expect(response.status).toBe(200)
        expect(dbMocks.rpc).toHaveBeenCalledWith('register_mobile_push_installation', {
            p_user_id: 'mobile-user',
            p_installation_id: 'install-1234567890',
            p_push_token: 'ExpoPushToken[secret-token]',
            p_platform: 'android',
            p_permission_status: 'granted',
            p_app_version: '1.0.0',
            p_locale: null,
            p_timezone: null,
            p_device_model: 'Test Phone',
        })
        expect(await response.text()).not.toContain('secret-token')
    })

    it('disables only the authenticated user installation and is idempotent', async () => {
        const maybeSingle = vi.fn()
        const builder: any = {
            update: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
                Promise.resolve({ data: null, error: null }).then(resolve, reject)
            ),
            maybeSingle,
        }
        dbMocks.from.mockReturnValue(builder)
        const request = () => new Request('http://localhost/api/mobile/push/register', {
            method: 'DELETE',
            headers: { Authorization: 'Bearer mobile-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ installationId: 'install-1234567890' }),
        })

        expect((await DELETE(request())).status).toBe(200)
        expect((await DELETE(request())).status).toBe(200)
        expect(builder.eq).toHaveBeenCalledWith('user_id', 'mobile-user')
        expect(builder.eq).toHaveBeenCalledWith('provider', 'expo')
        expect(builder.eq).toHaveBeenCalledWith('installation_id', 'install-1234567890')
    })
})
