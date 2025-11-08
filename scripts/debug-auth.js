// 调试认证状态的脚本
// 在浏览器控制台中运行这个脚本来诊断问题

// 调试认证状态
async function debugAuthState() {
  console.log('=== 认证状态调试 ===');
  
  // 1. 检查supabase客户端状态
  console.log('1. Supabase客户端状态:');
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('   - Session:', session);
  console.log('   - Error:', error);
  console.log('   - User ID:', session?.user?.id);
  console.log('   - Access Token 存在:', !!session?.access_token);
  
  // 2. 检查AuthService状态
  console.log('2. AuthService状态:');
  const authService = AuthService.getInstance();
  const authState = authService.getAuthState();
  console.log('   - isAuthenticated:', authState.isAuthenticated);
  console.log('   - User:', authState.user);
  console.log('   - Profile:', authState.profile);
  
  // 3. 尝试刷新session
  console.log('3. 尝试刷新session:');
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  console.log('   - Refresh结果:', refreshData);
  console.log('   - Refresh错误:', refreshError);
  
  // 4. 检查localStorage中的认证信息
  console.log('4. LocalStorage认证信息:');
  console.log('   - sb-[url]-auth-token:', localStorage.getItem('sb-localhost-auth-token')?.substring(0, 50) + '...');
  
  // 5. 测试提交记录前的token验证
  console.log('5. Token验证测试:');
  if (session?.access_token) {
    try {
      const response = await fetch('/api/test-auth', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      console.log('   - Token验证结果:', response.status);
    } catch (e) {
      console.log('   - Token验证错误:', e);
    }
  }
}

// 修复认证状态的函数
async function fixAuthState() {
  console.log('=== 尝试修复认证状态 ===');
  
  // 1. 强制刷新session
  console.log('1. 强制刷新session...');
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.error('刷新session失败:', error);
  } else {
    console.log('刷新session成功:', data);
  }
  
  // 2. 重新同步AuthService状态
  console.log('2. 重新同步AuthService...');
  const authService = AuthService.getInstance();
  await authService.validateAuthState();
  
  console.log('修复完成，请重新运行debugAuthState()检查状态');
}

// 在浏览器控制台运行：
// debugAuthState()
// 如果有问题，运行：fixAuthState()