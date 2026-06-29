/** @type {import('next').NextConfig} */
const nextConfig = {
    trailingSlash: true,
    images: { unoptimized: true },
    eslint: {
        ignoreDuringBuilds: true,
    },
    transpilePackages: ["@supabase/supabase-js"],
    experimental: {
        serverComponentsExternalPackages: ["pdfkit"],
    },
};

module.exports = nextConfig;