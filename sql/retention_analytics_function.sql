-- 创建留存分析函数
-- 该函数计算每日新增用户的 N 日留存情况
-- start_date: 开始日期 (包含)
-- end_date: 结束日期 (包含)

CREATE OR REPLACE FUNCTION get_retention_data(
  start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date text,
  new_users bigint,
  d1_count bigint,
  d3_count bigint,
  d7_count bigint,
  d30_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER -- 使用定义者的权限执行，确保能访问相关表
SET search_path = public, auth, extensions -- 确保能找到 uuid_generate_v4 等函数，且优先查找 public
AS $$
BEGIN
  RETURN QUERY
  WITH cohort AS (
    -- 1. 确定每一天的新增用户 (Cohort)
    SELECT
      u.id AS user_id,
      date_trunc('day', u.created_at)::date AS cohort_date
    FROM
      users u -- 默认查询 public.users，如果需要查询 auth.users 请修改为 "auth"."users"
    WHERE
      u.created_at >= start_date 
      AND u.created_at < (end_date + INTERVAL '1 day')
      -- AND (u.deleted_at IS NULL) -- 如果有软删除，可以取消注释
  ),
  activity AS (
    -- 2. 获取查询时间范围内用户的活跃记录 (去重，由 user_behavior_events 决定)
    -- 只有在 start_date 之后的活跃记录才对计算即期留存有意义
    SELECT DISTINCT
      e.user_id,
      date_trunc('day', e.created_at)::date AS activity_date
    FROM
      user_behavior_events e
    WHERE
      e.created_at >= start_date
  )
  SELECT
    to_char(c.cohort_date, 'YYYY-MM-DD') AS date,
    count(DISTINCT c.user_id) AS new_users,
    -- D1 留存 (次日)
    count(DISTINCT CASE WHEN a.activity_date = c.cohort_date + 1 THEN c.user_id END) AS d1_count,
    -- D3 留存
    count(DISTINCT CASE WHEN a.activity_date = c.cohort_date + 3 THEN c.user_id END) AS d3_count,
    -- D7 留存
    count(DISTINCT CASE WHEN a.activity_date = c.cohort_date + 7 THEN c.user_id END) AS d7_count,
    -- D30 留存
    count(DISTINCT CASE WHEN a.activity_date = c.cohort_date + 30 THEN c.user_id END) AS d30_count
  FROM
    cohort c
  LEFT JOIN
    activity a ON c.user_id = a.user_id
  GROUP BY
    c.cohort_date
  ORDER BY
    c.cohort_date DESC;
END;
$$;

-- 授权 Service Role 调用
GRANT EXECUTE ON FUNCTION get_retention_data(date, date) TO service_role;
