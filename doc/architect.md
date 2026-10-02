1. architect.md (시스템 아키텍처)
1.1. 아키텍처 개요
패턴: Unified Gateway & Micro-frontend Hybrid (Next.js App Router 기반)
핵심 원리: iframe을 배제하고, Next.js middleware.ts의 Rewrite 기능을 사용하여 단일 도메인(rustkorea.cloud) 내에서 서브도메인 앱을 마치 네이티브 라우팅인 것처럼 렌더링합니다.
세션 공유: 브라우저는 단일 도메인으로 인식하므로, HTTPOnly 쿠키 기반의 SSO(Single Sign-On)가 자연스럽게 작동하여 보안과 사용자 경험을 동시에 확보합니다.
1.2. 시스템 구성도
[Client: Mobile / Tablet / Desktop / Kiosk (21"~55")]
       │ (HTTPS)
       ▼
[Edge Network / CDN (Vercel Edge or Cloudflare)]
       │
       ▼
[Core Platform: Next.js App Router (rustkorea.cloud)]
   ├── middleware.ts (Dynamic Rewrite Engine)
   ├── /app (App Launcher, Admin Dashboard, Shared Shell Layout)
   ├── /api (Unified API Gateway: Auth, App Registry, Config)
   └── /apps/[slug]/[...path] (Dynamic Route Catch-all)
       │ (Internal Rewrite)
       ▼
[Sub-Apps: Existing Next.js Apps]
   ├── library.rustkorea.cloud  (basePath: '/apps/library' 설정)
   ├── aiplatform.rustkorea.cloud
   └── healthcare.rustkorea.cloud
       │
       ▼
[Database: PostgreSQL (Prisma ORM)]
   ├── users, applications, permissions, layout_configs
1.3. 키오스크 및 다중 디바이스 대응 전략
Vertical-First (세로형 우선) 렌더링: 모든 레이아웃은 세로 스크롤을 기본으로 설계하며, CSS Grid와 clamp()를 활용한 유동적 타이포그래피로 55인치 키오스크에서도 글자가 깨지지 않도록 보장합니다.
PWA (Progressive Web App): 키오스크 환경에서 브라우저 주소창을 숨기고 전체 화면(Fullscreen) 모드로 실행할 수 있도록 manifest.json 및 Service Worker를 코어 플랫폼에 포함합니다.

선택적 확장
추가 1: platform_settings 테이블 (플랫폼 전역 설정)
model PlatformSetting {
  id              String   @id @default(uuid())
  platformDomain  String   // 예: "rustkorea.cloud" 또는 "platform.customer-a.com"
  platformName    String   // 예: "러스트코리아" 또는 "고객A 통합포털"
  primaryColor    String   // 브랜드 컬러
  logoUrl         String
  allowedDomains  String[] // Allowlist (SSRF 방지용) - JSON 배열
  updatedAt       DateTime @updatedAt
}
→ 관리자가 플랫폼 자체의 도메인, 이름, 로고, 색상까지 대시보드에서 변경 가능.
추가 2: Multi-Tenant 구조 (고객사별 독립 플랫폼)
platform.customer-a.com  →  고객 A 전용 플랫폼 (라이브러리, AI, 헬스케어)
platform.customer-b.com  →  고객 B 전용 플랫폼 (쇼핑, CRM, 분석)
rustkorea.cloud          →  러스트코리아 자체 플랫폼
동작 방식: 요청이 들어온 Host 헤더를 미들웨어에서 확인 → platform_settings에서 해당 도메인의 설정 조회 → 해당 고객사의 앱 목록만 렌더링.
데이터 격리: applications 테이블에 tenant_id 컬럼 추가하여 고객사별 앱 격리.
