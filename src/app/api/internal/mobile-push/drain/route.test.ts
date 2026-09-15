import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const processorMocks = vi.hoisted(() => ({
    process: vi.fn(),
}))

vi.mock('@/lib/processMobileNotificationOutbox', () => ({
    processMobileNotificationOutbox: processorMocks.process,
    redactMobilePushError: (value: unknown) => String(value),
}))

import { GET, POST } from './route'

describe('mobile push drain route', () => {
    beforeEach(() => {
        vi.unstubAllEnvs()
        delete process.env.MOBILE_PUSH_CRON_SECRET
        delete process.env.CRON_SECRET
        processorMocks.process.mockReset().mockResolvedValue({ selected: 0 })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('stays disabled when no server-side secret is configured', async () => {
        const response = await POST(new Request('http://localhost/api/internal/mobile-push/drain', { method: 'POST' }))
        expect(response.status).toBe(503)
        expect(processorMocks.process).not.toHaveBeenCalled()
    })

    it('rejects a non-Bearer authorization value', async () => {
        vi.stubEnv('MOBILE_PUSH_CRON_SECRET', 'server-secret')
        const response = await POST(new Request('http://localhost/api/internal/mobile-push/drain', {
            method: 'POST',
            headers: { Authorization: 'Basic server-secret' },
        }))
        expect(response.status).toBe(401)
        expect(processorMocks.process).not.toHaveBeenCalled()
    })

    it('accepts a Bearer secret and normalizes a malformed limit', async () => {
        vi.stubEnv('MOBILE_PUSH_CRON_SECRET', 'server-secret')
        const response = await GET(new Request('http://localhost/api/internal/mobile-push/drain?limit=nope', {
            headers: { Authorization: 'Bearer server-secret' },
        }))
        expect(response.status).toBe(200)
        expect(processorMocks.process).toHaveBeenCalledWith(50)
    })

    it('is allowed through the proxy before route-level secret validation', () => {
        const proxySource = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8')
        expect(proxySource).toContain('"/api/internal/mobile-push/drain"')
    })
})
