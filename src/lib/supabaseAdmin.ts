import { Database } from '@/types/database.types';
import { createClient } from '@supabase/supabase-js';

const NEXT_SUPABASE_URL = process.env.NEXT_SUPABASE_URL;
const NEXT_SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

// 验证环境变量
if (!NEXT_SUPABASE_URL || !NEXT_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        '❌ 缺少必要的环境变量！\n\n' +
        '请在项目根目录创建 .env.local 文件并添加:\n' +
        'NEXT_SUPABASE_URL=your_supabase_url\n' +
        'NEXT_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key\n\n' +
        '获取密钥: Supabase Dashboard > Settings > API'
    );
}

// 服务端管理客户端，使用 service_role key 绕过 RLS
// ⚠️ 注意：此客户端仅用于服务端 API，拥有完全的数据库访问权限
// 绝不能在前端代码中使用！
const supabaseAdmin = createClient<Database>(
    NEXT_SUPABASE_URL, 
    NEXT_SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export default supabaseAdmin;
