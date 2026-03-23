-- ======================================
-- 身体部位共建文章功能
-- ======================================

-- 1. 创建文章编辑者关联表（支持多人共建）
create table if not exists knowledge_node_editors (
  id uuid primary key default gen_random_uuid(),
  node_id uuid references knowledge_nodes(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  contributed_at timestamptz default now(),
  contribution_type text default 'edit', -- 'create', 'edit', 'review'
  
  unique(node_id, user_id)
);

-- 索引加速查询
create index if not exists idx_knowledge_node_editors_node_id 
on knowledge_node_editors(node_id);

create index if not exists idx_knowledge_node_editors_user_id 
on knowledge_node_editors(user_id);

-- 2. 为 knowledge_nodes 添加共建相关字段
alter table knowledge_nodes 
add column if not exists is_collaborative boolean default false,
add column if not exists collaboration_enabled boolean default true;

-- 3. 获取文章及其编辑者的视图
create or replace view knowledge_nodes_with_editors as
select 
  kn.*,
  coalesce(
    json_agg(
      json_build_object(
        'user_id', kne.user_id,
        'contributed_at', kne.contributed_at,
        'contribution_type', kne.contribution_type,
        'user_name', u.raw_user_meta_data->>'name',
        'user_avatar', u.raw_user_meta_data->>'avatar_url'
      ) order by kne.contributed_at
    ) filter (where kne.user_id is not null),
    '[]'
  ) as editors
from knowledge_nodes kn
left join knowledge_node_editors kne on kn.id = kne.node_id
left join auth.users u on kne.user_id = u.id
group by kn.id;

-- 4. RLS 策略
drop policy if exists "Allow editors to update collaborative nodes" on knowledge_nodes;
create policy "Allow editors to update collaborative nodes"
  on knowledge_nodes
  for update
  using (
    collaboration_enabled = true 
    and exists (
      select 1 from knowledge_node_editors 
      where node_id = knowledge_nodes.id 
      and user_id = auth.uid()
    )
  );

-- 5. 函数：添加文章编辑者
create or replace function add_knowledge_node_editor(
  p_node_id uuid,
  p_user_id uuid,
  p_contribution_type text default 'edit'
) returns void as $$
begin
  insert into knowledge_node_editors (node_id, user_id, contribution_type)
  values (p_node_id, p_user_id, p_contribution_type)
  on conflict (node_id, user_id) 
  do update set 
    contributed_at = now(),
    contribution_type = p_contribution_type;
end;
$$ language plpgsql security definer;
