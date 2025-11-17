import { Database } from '@/types/database.types';
import { createClient } from '@supabase/supabase-js';

// 浏览器端专用客户端，使用 NEXT_PUBLIC_ 前缀的环境变量
// 如果 NEXT_PUBLIC_ 变量未设置，回退到 NEXT_ 变量（开发阶段兼容）
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('环境变量缺失:', {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_SUPABASE_URL: process.env.NEXT_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已设置' : '未设置',
        NEXT_SUPABASE_ANON_KEY: process.env.NEXT_SUPABASE_ANON_KEY ? '已设置' : '未设置',
    });
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment variables');
}

const supabaseBrowser = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabaseBrowser;

