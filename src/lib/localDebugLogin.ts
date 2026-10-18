import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const LOCAL_DEBUG_TOKEN_PREFIX = 'cldev.';
const audience = 'coachlink-local-debug';
const issuer = 'coachlink-local-launcher';
export const LOCAL_DEBUG_SESSION_SECONDS = 60 * 60;

// Separate, per-launch key: debug credentials must never verify with the normal
// NEXTAUTH_SECRET, even when local development uses the production database.
function key() {
    if (process.env.NODE_ENV !== 'development' || process.env.COACHLINK_LOCAL_DEBUG_LOGIN !== '1') return null;
    const value = process.env.COACHLINK_LOCAL_DEBUG_SIGNING_KEY || '';
    return value.length >= 64 ? value : null;
}

export function isLocalDebugEnabled() {
    return !!key() && (process.env.COACHLINK_LOCAL_DEBUG_PAIRING_CODE || '').length >= 32;
}

function isLoopbackHost(value: string) {
    try {
        const url = new URL(`http://${value}`);
        return !url.username && !url.password && url.pathname === '/' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { return false; }
}

export function isLocalDebugRequest(req: { url: string; headers: { get(name: string): string | null } }) {
    if (!isLocalDebugEnabled()) return false;
    try {
        const url = new URL(req.url);
        if (url.protocol !== 'http:' || !isLoopbackHost(url.host)) return false;
        const host = req.headers.get('host');
        if (!host || !isLoopbackHost(host)) return false;
        const forwardedHost = req.headers.get('x-forwarded-host');
        if (forwardedHost && !isLoopbackHost(forwardedHost)) return false;
        const forwardedFor = req.headers.get('x-forwarded-for');
        if (forwardedFor && !forwardedFor.split(',').every(ip => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip.trim()))) return false;
        // Browsers on another site cannot pair by posting to localhost.
        const origin = req.headers.get('origin');
        if (origin && origin !== url.origin) return false;
        if (req.headers.get('sec-fetch-site') === 'cross-site') return false;
        return true;
    } catch { return false; }
}

export function matchesLocalDebugPairingCode(value: unknown) {
    if (!isLocalDebugEnabled() || typeof value !== 'string') return false;
    const expected = Buffer.from(process.env.COACHLINK_LOCAL_DEBUG_PAIRING_CODE || '');
    const supplied = Buffer.from(value);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function signLocalDebugToken(userId: string) {
    const secret = key();
    if (!isLocalDebugEnabled() || !secret) throw new Error('Local debug login disabled');
    return LOCAL_DEBUG_TOKEN_PREFIX + jwt.sign({ userId, localDebug: true }, secret, {
        algorithm: 'HS256', audience, issuer, expiresIn: LOCAL_DEBUG_SESSION_SECONDS,
    });
}

export function verifyLocalDebugToken(token: string) {
    const secret = key();
    if (!isLocalDebugEnabled() || !secret || !token.startsWith(LOCAL_DEBUG_TOKEN_PREFIX)) return null;
    try {
        const claims = jwt.verify(token.slice(LOCAL_DEBUG_TOKEN_PREFIX.length), secret, {
            algorithms: ['HS256'], audience, issuer,
        });
        return typeof claims !== 'string' && claims.localDebug === true && typeof claims.userId === 'string' ? claims : null;
    } catch { return null; }
}

// Simulating a training account must not enable payments, account binding or
// administrative actions. Normal user sessions retain their existing behavior.
export function isDebugSensitivePath(pathname: string) {
    return /^\/api\/(?:admin|payment|wallet|withdraw|wechat|auth)(?:\/|$)/.test(pathname) ||
        /^\/api\/miniapp\/(?!session$|local-debug-login$)/.test(pathname) ||
        /(?:^|\/)(?:withdrawal|withdrawals|withdraw|refund|transfer|settlement|settlements|order|orders|bind-wechat|delete-account|reset-password|change-password)(?:\/|$)/.test(pathname);
}
