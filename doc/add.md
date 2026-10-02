# add.md - 전체 문서 분석 + 문제점 + 추가 제안

> 대상: `doc/agent.md`, `prd.md`, `architect.md`, `database.md`, `interface.md`, `api.md`, `uiux.md`, `security.md`, `constraints.md`, `program.md`, `risk.md`, `harness.md`, `tdd.md` (13종)
> 작성일: 2026-10-02 / 위치: `doc/add.md`

## 1. 전체 요약 (1줄 맵)

- `prd.md:2-20`: 비전 + 런처/어드민/셸/SSO + LCP 1.5s, WCAG AA
- `architect.md:3-30`: `middleware.ts` Rewrite 기반 단일도메인 통합 + PWA 키오스크
- `database.md:18-61`: `User/Application/UserAppPermission` 3모델만 정의
- `interface.md:3-32`: `AppRegistry/AppGrid/ResponsiveSidebar/useDeviceType` 타입 계약
- `api.md:3-31`: `GET /api/apps`, `POST /api/admin/apps`, `GET /api/auth/me` 스켈레톤
- `uiux.md:5-44`: Portrait 우선, 6단계 breakpoint, 4:5 카드, 48px 터치타겟
- `security.md:1-62`: ZeroTrust + 쿠키/SSRF/RateLimit/CSP + 체크리스트
- `constraints.md:7-204`: H1-H8 / D1-D5 / S1-S5 Hard Constraints + 성능/운영 제약
- `agent.md:7-85`: AI 가드레일 (8섹션, constraints 요약본)
- `program.md:3-17`: 5주 로드맵, `risk.md:5-16`: 4리스크, `harness.md:3-24`: CI/CD/Sentry, `tdd.md:2-10`: Jest/Playwright 전략

## 2. agent.md 정합성 검증

잘된 점:

- 4대 절대규칙 일치: `rewrite()` `agent.md:9`, `HTTPOnly/Secure/Strict` `agent.md:10`, `Allowlist` `agent.md:12`, `Zod/DOMPurify/Server Action` `agent.md:37-39` → `security.md:8-9,23-25,31`, `constraints.md:11-18,64-68`

문제점:

1. 경로 축소: `agent.md:11` `/apps/[slug]/[...path]` vs `agent.md:48` `/apps/[slug]` (후자는 심층라우팅 불가) → `architect.md:17` 전자로 통일
2. 문서경로 오기: `agent.md:58` `/docs` vs 실제 `doc/` (s 없음)
3. 미들웨어 위치 오기: `agent.md:54` `/apps/core-platform/middleware.ts` → Next.js는 프로젝트 루트 `core-platform/middleware.ts`만 인식
4. UI 단순화: Kiosk 43"~55" `4-5열, clamp(32px,1.5vw,48px)` `uiux.md:36-40`, Tablet 접이식 `80px`+FAB `uiux.md:43-44` 누락
5. 세션수명 누락: 일반 `24h 절대/2h 유휴` `security.md:11` 없음 (키오스크 3분만 있음 `agent.md:40`)
6. 타입 불일치: `ResponsiveSidebarProps.isMobile:boolean` `interface.md:23` vs `DeviceType 4-state` `interface.md:29`, `AppRegistry.isActive` 누락 vs `Application.isActive` `database.md:35`

## 3. 전체 교차검증 문제점 10건

| # | 문제 | 근거 | 영향 |
|---|------|------|------|
| P1 | 미들웨어 매요청 DB조회 vs 10ms 제약 | `architect.md:14` + `constraints.md:145` | Edge 지연 초과, LCP 1.5s 붕괴 |
| P2 | SSO 쿠키도메인 미정의 | 단일도메인 `security.md:9` vs 실체 `*.rustkorea.cloud` `architect.md:21-23` | 서브앱에서 세션 공유 실패 |
| P3 | CSP 플레이스홀더 | `security.md:18-20` = `http / 123456789` | XSS 방어선 없음, S2 위반 |
| P4 | DB 미완성 | `PlatformSetting/tenant_id/AuditLog/Session`은 `architect.md:34-49`에만, `database.md` 없음 | Multi-tenant/감사 불가 |
| P5 | API 스켈레톤 | Zod/에러포맷/페이지네이션/인가 없음 `api.md:19-29` | H5 위반 양산 |
| P6 | 도메인 하드코딩 자기모순 | 금지 `constraints.md:197-204` vs 예시 `https://*.rustkorea.cloud` `api.md:13,24`, `agent.md:4,10` | 확장 불가 |
| P7 | Breakpoint 충돌 | `1025px` `agent.md:30` vs `lg=1024px` `constraints.md:106`, `1025~1440` `uiux.md:21-25` | Tailwind `lg:` 오동작 |
| P8 | 폰트 clamp 3종 상이 | `agent.md:26` vs `uiux.md:15-40` vs `constraints.md:110-112` | 55인치 가독성 깨짐 |
| P9 | 정적자산 깨짐 대책 추상적 | `assetPrefix` 언급만 `risk.md:7`, `basePath`+Rewrite 충돌 재현절차 없음 | CSS/JS 404 |
| P10 | 운영 공백 | 회전90일 `constraints.md:160`, 백업키분리 `constraints.md:137`, 실기기테스트 `program.md:16` 구현절차 없음 | 상용 탈락 |

## 4. 추가 제안 (Must Do)

### 4.1 Middleware 고도화 (P1+P9 해결)

```ts
// middleware.ts (Edge, 10ms 예산)
import { NextResponse } from 'next/server';
const CACHE_TTL = 60; // SWR, KV/메모리 캐시
// 1. Host → tenant 해결 (headers().get('host'))
// 2. KV에서 applications+allowedDomains 조회, Miss시 DB
// 3. Allowlist 불일치 → 403 + AuditLog
// 4. NextResponse.rewrite(targetUrl + path) + x-tenant-id, x-app-slug 전파
```

- `ALLOWED_DOMAINS`는 `platform_settings.allowedDomains` DB 단일소스 + 메모리 캐시
- 서브앱 `next.config.js`: `basePath: '/apps/<slug>'`, `assetPrefix: '/apps/<slug>/'` 강제, `<Image>`만 허용 `constraints.md:119`
- 실패시 Fallback 런처로 `307` + Sentry 태깅

### 4.2 Auth/SSO 확정 (P2)

- 방식: opaque Session 테이블 (JWT stateless 금지 - 폐기/유휴관리 불가)
- 쿠키: `__Host-session` , `HttpOnly:true, Secure:true, SameSite:Lax (Strict는 톱레벨 네비게이션 끊김 — Lax로 완화 후 CSRF토큰 병행)`, `Domain:.rustkorea.cloud`, `Path:/`, `Max-Age: 86400`
- 수명: 일반 `절대 24h / 유휴 2h` `security.md:11` 유지, 키오스크 `유휴 3분 useIdleTimer` `security.md:12` 강제
- 해싱: `Argon2id` 우선, `bcrypt cost>=12` 허용 `constraints.md:127`
- `GET /api/auth/me`는 SSO 상태 확인용으로 세션+권한 반환

### 4.3 DB 확정 (P4)

```prisma
model PlatformSetting {
  id             String   @id @default(uuid())
  platformDomain String   @unique // Host 매칭용
  platformName   String
  primaryColor   String
  logoUrl        String
  allowedDomains String[] // SSRF Allowlist 단일소스
  updatedAt      DateTime @updatedAt
}
model Session {
  id        String   @id @default(uuid())
  userId    String
  expiresAt DateTime
  idleAt    DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, expiresAt])
}
model AuditLog {
  id        String   @id @default(uuid())
  actorId   String
  action    String   // app.register, auth.login.fail ...
  target    String?
  result    String   // success / fail
  createdAt DateTime @default(now())
  @@index([actorId, createdAt])
}
// Application에 추가: tenantId String? @@index([slug, isActive]) @@index([tenantId])
// UserAppPermission 유지 @@unique([userId, appId]) database.md:50
```

- `Layout_Config`는 `layout_configs(appId, deviceType, cols, order)` 로 구체화 (선택확장)
- 마이그레이션은 `prisma migrate`만 `constraints.md:93`, 파괴적 DDL 별도승인

### 4.4 API 계약 (P5+P6)

- 성공: `{ "success": true, "data": [...] }`, 실패: `{ "success": false, "error": { "code": "FORBIDDEN", "message": "..." } }`
- 전 Route `zod` 1차검증 `constraints.md:29-30`, 허용외 필드 strip, body 1MB/파일 10MB `constraints.md:133`
- `GET /api/apps?activeOnly=true` → 권한필터 + `displayOrder` 정렬, `POST /api/admin/apps`는 `ADMIN`만 + Allowlist 사전검증 + AuditLog + `revalidatePath('/api/apps')`
- RateLimit: `auth 5/min, 일반 100/min` `security.md:27-28` + `X-RateLimit-*` 헤더 (Upstash Redis)
- 도메인 참조는 `process.env.NEXT_PUBLIC_PLATFORM_DOMAIN` 또는 `platform_settings.platformDomain`만, 코드내 `rustkorea.cloud` 리터럴 금지 (H7) — 기존 예시는 예시임을 주석 명시, ESLint `no-hardcoded-domain` 추가

### 4.5 Security 확정 (P3)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

- `dangerouslySetInnerHTML` 금지, 예외시 DOMPurify `security.md:31`
- `productionBrowserSourceMaps:false` `security.md:35`, `console.log` 빌드제거, `npm audit 0 Critical/High` `security.md:61`
- CORS `*` 금지, WAF(Cloudflare) + TLS1.3 강제 `security.md:15-16,42-43`

### 4.6 UI 토큰 단일화 (P7+P8)

- Breakpoint: `mobile <768 (2열) / md>=768 (3열) / lg>=1024 (4열) / kiosk 4-5열` — `1025px` 표기 전부 `1024px`로 수정
- 카드 `aspect-[4/5]` 고정 `constraints.md:47`, 터치 `min-h-[48px] min-w-[48px]` `constraints.md:55`, 폰트는 전부 `clamp()` `constraints.md:109-112` (px 단독 금지 D3)
- 어드민: Desktop `w-[280px]`, Tablet `w-[80px]` 아이콘만, Mobile 사이드바 제거 + BottomNav/Drawer (+FAB 옵션) `uiux.md:42-44`
- 애니메이션 `Framer Motion`만, `transform/opacity` GPU만 `constraints.md:99-100`, 페이지전환 200ms fade `uiux.md:47`
- PWA `manifest.json`+SW로 키오스크 풀스크린 `architect.md:30`

### 4.7 Harness/TDD 보강

- CI: `lint → tsc --noEmit → prisma validate → jest → playwright → build → npm audit` 순서로 `harness.md:3-17` 확장, Node `20.x` 고정
- E2E (Playwright): `iPhone12(2열)/iPadPro(3열)/Desktop1920(4열)/Kiosk1080x1920(3-4열)` 스크린샷 비교 임계값 `<1%` `tdd.md:9` 구체화 + SSO 시나리오 `tdd.md:10` + `assetPrefix` 깨짐 회귀 + 유휴3분 로그아웃 타이머 모킹
- 모니터링: Sentry(프론트) + `/apps/[slug]`별 응답시간 Prometheus `harness.md:22-24`, AuditLog 1년 보관 `security.md:49`

## 5. 즉시 수정 체크리스트 (Pre-commit 확장)

- [ ] `iframe/object/embed`, `localStorage` 토큰, `Pages Router` 없음? (H1-H3)
- [ ] `clamp()` + `aspect-[4/5]` + `48px` 준수? (D2-D4)
- [ ] Rewrite 전 Allowlist 검증? (S1) + CSP 헤더? (S2)
- [ ] Zod 검증 + `ADMIN` 인가 + AuditLog? (H5)
- [ ] 도메인 리터럴 없음? `NEXT_PUBLIC_PLATFORM_DOMAIN` 사용? (H7) + SSR `headers()` 사용? (H8)
- [ ] `.env` 미커밋 + SourceMap off + 유휴타이머 + Lighthouse 90+? `constraints.md:179-189`

## 6. 로드맵 제안 (program.md 5주 보완)

- Week1: DB확정(P4)+KV캐시(P1)+ESLint(H7/H8)+Auth스키마(P2) — tenant 필요시 `tenant_id` 지금 포함 (`agent.md:84`)
- Week2: UI토큰(P6)+Shell/BottomNav + Storybook
- Week3: Rewrite+basePath 실증(P9)+SSO 쿠키도메인 실측
- Week4: Admin CRUD+AuditLog+revalidate
- Week5: 실기기 21"~55" + CSP/SSRF 침투 + Lighthouse 90+ + Sentry
