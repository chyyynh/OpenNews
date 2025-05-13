import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)", // 這會應用於所有路徑
        headers: [
          {
            key: "Content-Security-Policy",
            value: "script-src 'self' https://telegram.org;", // 允許來自 Telegram 網站的腳本
          },
        ],
      },
    ];
  },

  // 如果你需要強制 HTTPS，可以添加如下設定：
  // images: {
  //   domains: ['your-allowed-domain.com'],
  // },

  reactStrictMode: true, // 設置嚴格模式，可以根據需要開啟或關閉

  // 更多的 Next.js 設置根據需要添加
};

export default nextConfig;
