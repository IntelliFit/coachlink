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
        middlewareClientMaxBodySize: '50mb',
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
};

export default nextConfig;