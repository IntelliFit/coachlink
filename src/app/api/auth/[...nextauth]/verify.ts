import * as crypto from 'crypto';

const SALT = process.env.HASH_PASSWORD_SALT || 'smart_health_alliance_salt';

/**
 * 计算密码的 SHA-256 哈希值
 * @param password - 用户提交的密码
 * @returns 计算后的哈希值（十六进制字符串）
 */
export function hashPassword(password: string): string {
    // 使用与前端相同的盐值
    const hash = crypto.createHash('sha256');
    hash.update(password + SALT);
    return hash.digest('hex');
}

/**
 * 验证用户提交的密码是否与数据库中的哈希值匹配
 * @param password - 用户提交的密码
 * @param storedHash - 数据库中存储的哈希值
 * @returns 是否匹配
 */
export function verifyPassword(password: string, storedHash: string): boolean {
    // 计算用户提交密码的哈希值
    const hash = hashPassword(password);
    // 使用恒定时间比较函数防止时序攻击
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}