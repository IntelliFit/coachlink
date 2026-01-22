-- Web Push 订阅表：存储用户端的 Push 订阅，用于后端发送系统/消息通知
-- 兼容 Android 常见浏览器与 iOS Safari 16.4+

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

COMMENT ON TABLE public.push_subscriptions IS 'Web Push 订阅，按 user_id + endpoint 唯一';
COMMENT ON COLUMN public.push_subscriptions.user_id IS 'NextAuth users.id';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'PushManager 订阅 endpoint';
COMMENT ON COLUMN public.push_subscriptions.keys_p256dh IS 'keys.p256dh';
COMMENT ON COLUMN public.push_subscriptions.keys_auth IS 'keys.auth';

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);

-- RLS：用户仅能管理自己的订阅
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

-- 后端发送推送时需用 service_role 绕过 RLS 按 user_id 查询
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
