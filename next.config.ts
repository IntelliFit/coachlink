import type { NextConfig } from 'next';

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
                hostname: "*",
            },
        ],
    },
    async redirects() {
        return [];
    },
};

export default nextConfig;