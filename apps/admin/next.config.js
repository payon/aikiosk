const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  // 런처 도메인 아래 /admin 으로 마운트됨 — 직접 포트 접근은 개발용
  basePath: "/admin",
  async headers() {
    // 런처 경유 rewrite 시 런처 CSP가 적용되므로 동일 값 유지 (Next.js 동작 보장)
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
          }
        ]
      }
    ];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  }
};
module.exports = nextConfig;
