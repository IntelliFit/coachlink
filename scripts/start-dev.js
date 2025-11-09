// 加载环境变量
require('dotenv').config({ 
  path: `.env.${process.env.NODE_ENV || 'development'}`
});

console.log('='.repeat(50));
console.log('COACHLINK DEVELOPMENT SERVER');
console.log('='.repeat(50));
console.log('Environment Configuration:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`- Environment file: .env.${process.env.NODE_ENV || 'development'}`);
console.log(`- Supabase URL: ${process.env.NEXT_SUPABASE_URL ? '[SET]' : '[NOT SET]'}`);
console.log(`- App Name: ${process.env.NEXT_PUBLIC_APP_NAME || 'Not set'}`);
console.log('='.repeat(50));

// 启动Next.js开发服务器
const { spawn } = require('child_process');

const nextDev = spawn('next', ['dev'], { stdio: 'inherit' });

nextDev.on('close', (code) => {
  console.log(`Next.js development server exited with code ${code}`);
});