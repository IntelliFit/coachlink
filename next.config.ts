import type { NextConfig } from 'next';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readPackageVersion(): string {
    try {
        const packageJsonPath = join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
        return packageJson.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

function readGitCommitId(): string {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
}

const SUPABASE_HOST =
    (process.env.NEXT_SUPABASE_URL ? new URL(process.env.NEXT_SUPABASE_URL).hostname : undefined) ||
    'supabase.co';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || readPackageVersion();
const GIT_COMMIT_ID = process.env.NEXT_PUBLIC_GIT_COMMIT_ID || readGitCommitId();
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: false,
    env: {
        NEXT_PUBLIC_APP_VERSION: APP_VERSION,
        NEXT_PUBLIC_GIT_COMMIT_ID: GIT_COMMIT_ID,
        NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
        APP_VERSION,
        GIT_COMMIT_ID,
        BUILD_TIME,
    },
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
        ];
    },
};

export default nextConfig;
