import { createServerSupabaseClient } from '@/lib/supabaseServerClient';
import { redirect } from 'next/navigation';
import { cache } from 'react';

// 获取当前用户信息
export const getCurrentUser = cache(async () => {
  const supabase = createServerSupabaseClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }

  return user;
});

// 检查用户是否已认证
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return !!user;
};

// 服务端保护路由的函数
export const requireAuth = async () => {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    redirect('/login');
  }
  
  return await getCurrentUser();
};

// 服务端检查是否未认证（用于登录/注册页面）
export const requireNoAuth = async () => {
  const authenticated = await isAuthenticated();
  
  if (authenticated) {
    redirect('/dashboard');
  }
};