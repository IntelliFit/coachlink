// 用于生成开发用户密码哈希的脚本
// 运行方式: node scripts/generate-dev-password-hash.js

const crypto = require('crypto');

const SALT = process.env.HASH_PASSWORD_SALT || 'smart_health_alliance_salt';

function hashPassword(password) {
    const hash = crypto.createHash('sha256');
    hash.update(password + SALT);
    return hash.digest('hex');
}

// 开发用户密码 (从 NEXT_PUBLIC_DEV_USERS 获取，通常是 123456)
const password = '123456';
const hash = hashPassword(password);

console.log('='.repeat(60));
console.log('开发用户密码哈希生成器');
console.log('='.repeat(60));
console.log(`密码: ${password}`);
console.log(`Salt: ${SALT}`);
console.log(`哈希: ${hash}`);
console.log('='.repeat(60));
console.log();
console.log('请在 Supabase SQL Editor 中执行以下 SQL:');
console.log();
console.log(`UPDATE users SET password_hash = '${hash}' WHERE phone IN ('13915850621', '13921064643', '18115072586');`);
