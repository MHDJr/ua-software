/** @type {import('next').NextConfig} */
const nextConfig = {
    trailingSlash: true,
    images: { unoptimized: true },
    eslint: {
        ignoreDuringBuilds: true,
    },
    transpilePackages: ["@supabase/supabase-js"],
};

module.exports = nextConfig;