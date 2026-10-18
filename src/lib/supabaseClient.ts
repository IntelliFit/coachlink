import type { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { createClient } from '@supabase/supabase-js';

// 惰性初始化：构建阶段 Next.js 会导入所有路由，若此时调用 createClient 且无 env，
// 会抛出 "supabaseUrl is required"。改为首次使用时再创建，构建时不会触发。
function getEnv() {
    const url =
        process.env.NEXT_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        '';
    const anonKey =
        process.env.NEXT_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        '';
    const serviceKey =
        process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        '';
    return { url, anonKey, serviceKey: serviceKey || anonKey };
}

let _supabase: SupabaseClient<Database> | null = null;
let _serviceRoleSupabase: SupabaseClient<Database> | null = null;

// The default client is used only by server code, which authenticates the
// caller itself (NextAuth / app JWT) and never carries a Supabase Auth session.
// It therefore uses the service key when one is configured, so the database can
// deny the public anon role entirely without breaking any API route.
function getSupabase(): SupabaseClient<Database> {
    if (!_supabase) {
        const { url, anonKey, serviceKey } = getEnv();
        const key = serviceKey || anonKey;
        if (!url || !key) {
            throw new Error('Supabase URL and a service or anon key are required. Set NEXT_SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE_KEY.');
        }
        _supabase = createClient<Database>(url, key);
    }
    return _supabase;
}

function getServiceRoleSupabase(): SupabaseClient<Database> {
    if (!_serviceRoleSupabase) {
        const { url, serviceKey } = getEnv();
        if (!url || !serviceKey) {
            throw new Error('Supabase URL and service key are required.');
        }
        _serviceRoleSupabase = createClient<Database>(url, serviceKey);
    }
    return _serviceRoleSupabase;
}

// 使用 Proxy 实现惰性初始化，调用方无需修改，仍可 supabase.from(...)
// getSupabase/getServiceRoleSupabase 内部有 if (!_xxx) 检查，只会创建一次，之后复用同一实例（单例）
const supabase = new Proxy({} as SupabaseClient<Database>, {
    get(_, prop) {
        return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
    },
});

const serviceRoleSupabase = new Proxy({} as SupabaseClient<Database>, {
    get(_, prop) {
        return (getServiceRoleSupabase() as unknown as Record<string | symbol, unknown>)[prop];
    },
});

export default supabase;
export { serviceRoleSupabase };
