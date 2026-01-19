-- Add wechat_openid column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid TEXT UNIQUE;

-- Create index for faster lookups by wechat_openid
CREATE INDEX IF NOT EXISTS idx_users_wechat_openid ON users (wechat_openid);
