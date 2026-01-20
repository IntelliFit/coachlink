#!/bin/bash

# 1. 本地编译
echo "🚀 开始本地编译..."
npm run build

# 2. 打包
echo "📦 正在打包..."
tar -czvf coachlink.tar.gz .next/standalone

# 3. 上传到服务器
echo "🚚 正在上传到服务器..."
scp coachlink.tar.gz root@154.8.205.78:/www/wwwroot/coachlink/

# 4. 远程执行解压和清理
echo "☁️  正在服务器上解压并重启..."
ssh root@154.8.205.78 "cd /www/wwwroot/coachlink && rm -rf .next && tar -xvf coachlink.tar.gz && echo '✅ 服务器解压完成'"

# 5. 可选：清理本地压缩包
rm coachlink.tar.gz

echo "🎉 部署成功！"