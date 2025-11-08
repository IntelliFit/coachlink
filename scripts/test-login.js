// 登录流程调试脚本
// 在浏览器控制台运行这些命令来诊断登录问题

async function testLoginFlow() {
  console.log('=== 登录流程调试 ===');
  
  // 1. 检查Supabase配置
  console.log('1. Supabase配置检查:');
  console.log('   - URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('   - Anon Key存在:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
  
  // 2. 测试直接登录
  console.log('2. 测试认证API:');
  
  // 测试用账号（你可以修改为你自己的测试账号）
  const testPhone = '13800138000';
  const testPassword = 'test123';
  
  try {
    const authService = AuthService.getInstance();
    
    console.log('3. 尝试登录...');
    const result = await authService.loginWithPassword(testPhone, testPassword);
    console.log('   登录结果:', result);
    
    if (result.success) {
      console.log('✅ 登录成功！');
      
      // 4. 验证登录状态
      console.log('4. 验证登录状态:');
      const authState = authService.getAuthState();
      console.log('   - 认证状态:', authState);
      
      // 5. 检查session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('   - Session:', session);
      
    } else {
      console.log('❌ 登录失败:', result.message);
    }
    
  } catch (error) {
    console.error('登录测试失败:', error);
  }
}

// 检查浏览器存储
function checkBrowserStorage() {
  console.log('=== 浏览器存储检查 ===');
  
  // 检查localStorage
  console.log('1. localStorage中的认证信息:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('supabase') || key.includes('auth')) {
      console.log(`   ${key}:`, localStorage.getItem(key)?.substring(0, 50) + '...');
    }
  }
  
  // 检查sessionStorage
  console.log('2. sessionStorage中的认证信息:');
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.includes('supabase') || key.includes('auth')) {
      console.log(`   ${key}:`, sessionStorage.getItem(key)?.substring(0, 50) + '...');
    }
  }
}

// 重置认证状态
async function resetAuthState() {
  console.log('=== 重置认证状态 ===');
  
  // 清除本地存储
  localStorage.clear();
  sessionStorage.clear();
  
  // 清除AuthService状态
  const authService = AuthService.getInstance();
  authService.logout();
  
  // 强制重新初始化Supabase客户端
  console.log('✅ 认证状态已重置');
}

// 运行测试
console.log('可用命令:');
console.log('- testLoginFlow() - 测试登录流程');
console.log('- checkBrowserStorage() - 检查浏览器存储');
console.log('- resetAuthState() - 重置认证状态');