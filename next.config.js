/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
    eslint: {
        ignoreDuringBuilds: true,
    },
    transpilePackages: ["@supabase/supabase-js"],
};

module.exports = nextConfig;