// 服务端使用（SSR）
import { cookies } from 'next/headers';
import { cache } from 'react';
import { type CookieOptions, createServerClient } from '@supabase/ssr';

// 检查环境变量是否存在
const supabaseUrl = process.env.NEXT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_SUPABASE_ANON_KEY;

// 验证环境变量
if (!supabaseUrl) {
  throw new Error('Missing NEXT_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_SUPABASE_ANON_KEY environment variable');
}

// 服务端使用（SSR）
export const createServerSupabaseClient = cache(() => {
  const cookieStore = cookies();
  
  return createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // 处理cookie设置错误
            console.error('Error setting cookie:', error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // 处理cookie删除错误
            console.error('Error removing cookie:', error);
          }
        },
      },
    }
  );
});