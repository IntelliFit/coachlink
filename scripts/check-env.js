const fs = require('fs');
const path = require('path');

console.log('Checking environment files...\n');

// 检查环境文件
const envFiles = ['.env.development', '.env.production'];

envFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file} found`);
    
    // 读取文件内容并显示基本信息
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
    console.log(`  Variables: ${lines.length}`);
  } else {
    console.log(`✗ ${file} not found`);
  }
});

console.log('\nEnvironment check completed.');