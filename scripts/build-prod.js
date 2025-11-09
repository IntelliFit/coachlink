const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(50));
console.log('COACHLINK BUILD PROCESS');
console.log('='.repeat(50));

// 检查生产环境文件是否存在
const prodEnvPath = path.join(__dirname, '..', '.env.production');
if (!fs.existsSync(prodEnvPath)) {
  console.error('Error: .env.production file not found!');
  process.exit(1);
}

console.log('✓ Using .env.production for build process');
console.log('✓ Environment variables status:');
console.log('- NEXT_SUPABASE_URL:', process.env.NEXT_SUPABASE_URL ? '[SET]' : '[NOT SET]');
console.log('- NEXT_SUPABASE_ANON_KEY:', process.env.NEXT_SUPABASE_ANON_KEY ? '[SET]' : '[NOT SET]');
console.log('✓ Starting Next.js build...');

// 设置环境变量
process.env.NODE_ENV = 'production';

// 运行Next.js构建
const nextBuild = spawn('next', ['build'], { 
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

nextBuild.on('close', (code) => {
  if (code === 0) {
    console.log('\n✓ Build completed successfully!');
    console.log('✓ Only .env.production variables are included in the build');
  } else {
    console.log(`\n✗ Build failed with code ${code}`);
  }
});