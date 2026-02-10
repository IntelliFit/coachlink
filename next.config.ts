import type { NextConfig } from 'next';

const SUPABASE_HOST =
    (process.env.NEXT_SUPABASE_URL ? new URL(process.env.NEXT_SUPABASE_URL).hostname : undefined) ||
    'supabase.co';

const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: false,
    pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        // 训练执行视频上传需要超过默认 10MB 的 Request Body 限制
        proxyClientMaxBodySize: '50mb',
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: SUPABASE_HOST.startsWith('supabase.co') ? '**.supabase.co' : SUPABASE_HOST,
            },
        ],
    },
    async redirects() {
        return [];
    },
    async headers() {
        const isDev = process.env.NODE_ENV === 'development';
        
        // 开发环境：短缓存（10秒），方便调试
        // 生产环境：根据内容类型设置不同缓存时间
        const pageCacheControl = isDev
            ? 'public, s-maxage=10, stale-while-revalidate=5' // 开发环境：10秒缓存
            : 'public, s-maxage=300, stale-while-revalidate=60'; // 生产环境：5分钟缓存
        
        return [
            {
                // API 路由：不缓存（API 响应通常是动态的）
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, no-cache, must-revalidate',
                    },
                ],
            },
            {
                // 页面路由：根据环境设置缓存时间
                source: '/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: pageCacheControl,
                    },
                ],
            },
        ];
    },
};

export default nextConfig;