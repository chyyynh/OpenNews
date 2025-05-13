import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' https://telegram.org 'unsafe-inline';
              connect-src 'self' https://api.telegram.org https://*.supabase.co;
              img-src 'self' https://t.me data:;
              style-src 'self' 'unsafe-inline';
              frame-src https://telegram.org;
            `
              .replace(/\s{2,}/g, " ")
              .trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
