-- 教练转化埋点：谁看了哪位教练、点没点购买、为什么没订阅。
-- 未登录访客也要统计，所以不复用 user_behavior_events（它的 user_id 不能为空）。
-- 只由服务端用 service role 读写，公开角色没有任何权限。

CREATE TABLE IF NOT EXISTS public.coach_funnel_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event       text NOT NULL,
    -- 外键顺带挡掉伪造的教练 id；list_view 没有具体教练
    coach_id    uuid REFERENCES public.coaches(id) ON DELETE CASCADE,
    user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
    anon_id     text,
    platform    text NOT NULL,
    reason      text,
    note        text,
    properties  jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_funnel_events_created_at
    ON public.coach_funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_funnel_events_coach_created
    ON public.coach_funnel_events (coach_id, created_at DESC);

ALTER TABLE public.coach_funnel_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_funnel_events FROM anon, authenticated;
