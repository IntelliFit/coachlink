import { Database } from '@/types/database.types';
import { createClient } from '@supabase/supabase-js';

// 仅使用服务端环境变量，避免 NEXT_PUBLIC_* 打进服务端 bundle 或与前端混用
const NEXT_SUPABASE_URL =
    process.env.NEXT_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
const NEXT_SUPABASE_ANON_KEY =
    process.env.NEXT_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
const NEXT_SUPABASE_SERVICE_ROLE_KEY =
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';

const supabase = createClient<Database>(NEXT_SUPABASE_URL, NEXT_SUPABASE_ANON_KEY);
// IMPORTANT:
// 某些环境（本地/预览）可能未配置 service role key。
// 如果这里直接用空字符串初始化，supabase-js 可能在模块加载阶段抛错，
// 导致相关 API 返回 HTML 错误页（前端解析 JSON 会报 Unexpected token '<'）。
// 这里做兜底：未配置时用 anon key 初始化，API 内部仍会做 env 检查并返回 JSON 错误。
const serviceRoleSupabase = createClient<Database>(
    NEXT_SUPABASE_URL,
    NEXT_SUPABASE_SERVICE_ROLE_KEY || NEXT_SUPABASE_ANON_KEY,
);

export default supabase;
export { serviceRoleSupabase };
