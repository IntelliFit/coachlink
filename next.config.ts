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

// OpenTelemetry's Node SDK and its OTLP/gRPC exporters load Node built-ins at
// runtime. Keep them out of Next's webpack bundle (including the
// instrumentation bundle) so Node resolves those built-ins directly.
const nodeOnlyServerPackages = [
    'kafkajs',
    '@grpc/grpc-js',
    '@opentelemetry/api',
    '@opentelemetry/exporter-metrics-otlp-grpc',
    '@opentelemetry/exporter-trace-otlp-grpc',
    '@opentelemetry/instrumentation-http',
    '@opentelemetry/resources',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/sdk-node',
    '@opentelemetry/sdk-trace-base',
];

const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: false,
    // Next 16 uses Turbopack by default. Declare it explicitly so production
    // builds can coexist with the Node-only webpack externals below.
    turbopack: {},
    serverExternalPackages: nodeOnlyServerPackages,
    webpack(config, { isServer, nextRuntime }) {
        if (isServer && nextRuntime !== 'edge') {
            // The instrumentation compiler does not consistently apply
            // serverExternalPackages. Explicit externals keep gRPC/OTel out of
            // webpack while preserving CommonJS require() calls for Next's
            // standalone output-file tracing.
            config.externals.push(
                (
                    { request }: { request?: string },
                    callback: (error?: Error | null, result?: string) => void,
                ) => {
                    const shouldExternalize = request === '@grpc/grpc-js'
                        || request?.startsWith('@grpc/grpc-js/')
                        || request?.startsWith('@opentelemetry/');
                    if (request && shouldExternalize) {
                        callback(null, `commonjs ${request}`);
                        return;
                    }
                    callback();
                },
            );
        }
        return config;
    },
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
        // 大量静态页面并行生成时会显著抬高内存占用；默认限制构建并发，发布机可按资源调高。
        cpus: Math.max(1, Number.parseInt(process.env.NEXT_BUILD_CPUS || '2', 10) || 2),
        // 视频工具会产生大于原始输入的分析结果；默认抬到 200MB，仍可用环境变量收紧或放宽。
        proxyClientMaxBodySize: process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE || '200mb',
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
