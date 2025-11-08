import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 添加空的turbopack配置以明确使用Turbopack
  turbopack: {},
  
  // 在构建时输出使用的环境配置文件
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'CoachLink',
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  }
};

export default nextConfig;