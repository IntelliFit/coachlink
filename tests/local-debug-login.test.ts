import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { isLocalDebugRequest, matchesLocalDebugPairingCode, signLocalDebugToken, verifyLocalDebugToken, isDebugSensitivePath } from '../src/lib/localDebugLogin';
import { verifyToken, signToken } from '../src/lib/jwt';
import { POST } from '../src/app/api/miniapp/local-debug-login/route';

const userId = 'aaa90e01-7a53-444d-b374-9edfe438fa17';
const mock = vi.hoisted(() => ({ from: vi.fn(), user: { id: 'aaa90e01-7a53-444d-b374-9edfe438fa17', phone: '13800006196', is_admin: false, primary_role: 'student' } }));
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: { from: mock.from } }));
const request = (url = 'http://127.0.0.1:3003/api/miniapp/local-debug-login', headers = {}, body: unknown = { userId }) => new NextRequest(url, {
    method: 'POST', headers: { host: new URL(url).host, 'content-type': 'application/json', 'x-coachlink-debug-code': 'p'.repeat(32), ...headers }, body: JSON.stringify(body),
});
beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('COACHLINK_LOCAL_DEBUG_LOGIN', '1');
    vi.stubEnv('COACHLINK_LOCAL_DEBUG_SIGNING_KEY', 's'.repeat(96));
    vi.stubEnv('COACHLINK_LOCAL_DEBUG_PAIRING_CODE', 'p'.repeat(32));
    mock.user.is_admin = false;
    mock.from.mockReset().mockImplementation(table => {
        const data = table === 'users' ? mock.user : table === 'user_profiles' ? { nickname: '手机用户_6196' } : null;
        const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn(async () => ({ data, error: null })) };
        return chain; // deliberately no insert/update/delete methods
    });
});
afterEach(() => vi.unstubAllEnvs());

describe('local debug login security boundary', () => {
    it.each(['production', 'test'])('rejects %s even with all flags and keys set', async mode => {
        vi.stubEnv('NODE_ENV', mode);
        expect((await POST(request())).status).toBe(404);
        expect(mock.from).not.toHaveBeenCalled();
    });
    it('fails closed without explicit enable', async () => {
        vi.stubEnv('COACHLINK_LOCAL_DEBUG_LOGIN', '');
        expect((await POST(request())).status).toBe(404);
    });
    it.each(['https://coachlink.fit', 'http://192.168.1.20:3003', 'http://localhost.evil.test', 'https://127.0.0.1:3003'])('rejects nonlocal target %s', target => {
        expect(isLocalDebugRequest(request(`${target}/api/miniapp/local-debug-login`))).toBe(false);
    });
    it.each([{ host: 'evil.test' }, { 'x-forwarded-host': 'dev.coachlink.fit' }, { 'x-forwarded-for': '192.168.0.1' }, { origin: 'https://evil.test' }, { 'sec-fetch-site': 'cross-site' }])('rejects untrusted request context %o', headers => {
        expect(isLocalDebugRequest(request(undefined, headers))).toBe(false);
    });
    it('accepts Next loopback forwarding and rejects wrong pairing before database access', async () => {
        expect(isLocalDebugRequest(request(undefined, { 'x-forwarded-for': '127.0.0.1', 'x-forwarded-host': '127.0.0.1:3003' }))).toBe(true);
        expect(matchesLocalDebugPairingCode(null)).toBe(false);
        expect((await POST(request(undefined, { 'x-coachlink-debug-code': 'wrong' }))).status).toBe(403);
        expect(mock.from).not.toHaveBeenCalled();
    });
    it('validates UUID without creating users', async () => {
        expect((await POST(request(undefined, {}, { userId: 'not-a-uuid' }))).status).toBe(400);
        expect(mock.from).not.toHaveBeenCalled();
    });
    it('reads only, preserves nickname, and issues a separate one-hour token', async () => {
        const response = await POST(request());
        const result = await response.json();
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(result.data.user.nickname).toBe('手机用户_6196');
        const claims = verifyToken(result.data.token) as jwt.JwtPayload;
        expect(claims.userId).toBe(userId);
        expect(claims.exp! - claims.iat!).toBe(3600);
        expect(() => jwt.verify(result.data.token.slice(6), process.env.NEXTAUTH_SECRET || 'your_jwt_secret')).toThrow();
    });
    it('refuses administrators', async () => {
        mock.user.is_admin = true;
        expect((await POST(request())).status).toBe(403);
    });
    it('rejects tampered, expired, old-launch and production debug tokens', () => {
        const token = signLocalDebugToken(userId);
        expect(verifyLocalDebugToken(token)?.userId).toBe(userId);
        expect(verifyLocalDebugToken(token + 'x')).toBeNull();
        vi.useFakeTimers();
        try { vi.setSystemTime(Date.now() + 3601_000); expect(verifyToken(token)).toBeNull(); } finally { vi.useRealTimers(); }
        vi.stubEnv('COACHLINK_LOCAL_DEBUG_SIGNING_KEY', 'new'.repeat(32));
        expect(verifyToken(token)).toBeNull();
        vi.stubEnv('NODE_ENV', 'production');
        expect(verifyToken(token)).toBeNull();
        // Existing mobile authentication remains valid.
        expect((verifyToken(signToken({ userId })) as jwt.JwtPayload).userId).toBe(userId);
    });
    it.each(['/api/payment/wechat/create', '/api/admin/users', '/api/miniapp/bind-wechat', '/api/user/withdraw', '/api/coach/withdrawals'])('blocks sensitive route %s', path => {
        expect(isDebugSensitivePath(path)).toBe(true);
    });
    it('does not change training ownership decisions', () => {
        expect(isDebugSensitivePath('/api/execution/start')).toBe(false);
        expect(isDebugSensitivePath('/api/plan-lib/get-instance')).toBe(false);
    });
});
