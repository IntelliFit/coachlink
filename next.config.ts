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