import { serialize, parse } from 'cookie';

export function setTokenCookie(token: string) {
    return serialize('auth_token', token, {
        httpOnly: true,
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 天
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
}

export function parseCookies(cookieHeader: string | null) {
    return cookieHeader ? parse(cookieHeader) : {};
}
