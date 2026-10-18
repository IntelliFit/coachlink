import jwt from 'jsonwebtoken';
import { LOCAL_DEBUG_TOKEN_PREFIX, verifyLocalDebugToken } from './localDebugLogin';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your_jwt_secret';

export function signToken(payload: object) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
    if (token.startsWith(LOCAL_DEBUG_TOKEN_PREFIX)) return verifyLocalDebugToken(token);
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}
