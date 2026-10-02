const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";
const ADMIN = process.env.ADMIN_INTERNAL_URL || "http://127.0.0.1:4502";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  async rewrites() {
    // 단일 도메인: 브라우저에 포트를 노출하지 않는다.
    // /admin/* → 어드민 앱, /api/* → 백엔드 API
    return [
      { source: "/admin", destination: `${ADMIN}/admin` },
      { source: "/admin/:path*", destination: `${ADMIN}/admin/:path*` },
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ]
  }
};
module.exports = nextConfig;
