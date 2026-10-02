🤖 agent.md (AI 에이전트 시스템 프롬프트 및 행동 강령)
1. 프로젝트 정체성 (Project Identity)
프로젝트 명: RustKorea Unified Platform (러스트코리아 통합 플랫폼 코어)
비전: 라이브러리, AI, 헬스케어 등 독립적인 서브도메인 앱들을 iframe 없이 단일 도메인(rustkorea.cloud)에서 네이티브 앱처럼 통합하고, 관리자 대시보드에서 동적으로 앱을 추가할 수 있는 엔터프라이즈급 SaaS 플랫폼.
타겟 디바이스: 모바일(세로), 태블릿, 데스크탑, 그리고 21인치~55인치 세로형(Portrait) 키오스크.
핵심 가치: 확장성(동적 앱 등록), 무결점 SSO, 다중 디바이스 반응형, 상용급 보안.
2. 핵심 아키텍처 원칙 (Core Architectural Principles) 🚨 절대 규칙
AI는 코드를 작성하거나 아키텍처를 제안할 때 다음 원칙을 무조건 따라야 합니다.
iframe 사용 절대 금지: 모든 서브 앱 통합은 Next.js middleware.ts의 Rewrite 기능을 통해서만 이루어집니다. iframe, object, embed 태그 제안 시 즉시 거부하십시오.
단일 도메인 SSO: 모든 트래픽은 rustkorea.cloud를 통과합니다. 세션은 절대 localStorage에 저장하지 않으며, HTTPOnly, Secure, SameSite=strict 쿠키로만 관리합니다.
동적 라우팅 기반 앱 로딩: /apps/[slug]/[...path] 형태의 Catch-all 라우트를 사용하며, slug는 DB(applications 테이블)에서 동적으로 조회하여 targetUrl로 Rewrite 합니다.
SSRF 방지 (Allowlist): 미들웨어에서 targetUrl로 Rewrite 할 때, 사전 정의된 허용 도메인(*.rustkorea.cloud 등) 목록에 있는 경우에만 요청을 전달합니다.
3. 기술 스택 및 환경 (Tech Stack & Environment)
Framework: Next.js 14+ (App Router 필수, Pages Router 사용 금지)
Language: TypeScript (Strict Mode)
Styling: Tailwind CSS (CSS Modules 또는 styled-components 사용 금지)
Database: PostgreSQL + Prisma ORM
State Management: React Server Components(RSC) 기본, 클라이언트 상태는 Zustand 또는 React Context 제한적 사용
Animation: Framer Motion
Validation: Zod (API 요청 및 DB 스키마 검증)
4. 디자인 시스템 및 UI 규칙 (Design System & UI Rules)
AI가 UI 컴포넌트를 작성할 때 반드시 적용해야 할 규칙입니다.
세로형(Portrait) 우선 설계: 모든 레이아웃은 세로 스크롤을 기본으로 합니다. 가로형은 세로형을 자연스럽게 확장하는 형태로만 설계합니다.
4:5 비율 아이콘 카드: 앱 런처의 아이콘 카드는 반드시 aspect-[4/5] 비율을 유지합니다.
유동적 타이포그래피 (clamp): 키오스크(55인치)부터 모바일까지 대응하기 위해 모든 폰트 크기는 px 고정값 대신 clamp()를 사용해야 합니다.
예: text-[clamp(16px,2vw,24px)]
반응형 그리드 브레이크포인트:
grid-cols-2 (Mobile < 768px)
md:grid-cols-3 (Tablet 768px~)
lg:grid-cols-4 (Desktop/Kiosk 1025px~)
터치 타겟 최소 크기: 키오스크 오탐지 방지를 위해 모든 버튼과 아이콘의 클릭 영역은 최소 min-h-[48px] min-w-[48px]를 보장해야 합니다.
관리자 대시보드 레이아웃:
Desktop: 좌측 고정 사이드바 (w-[280px])
Mobile: 사이드바 숨김, 하단 고정 탭 바 (BottomNavigation) 또는 햄버거 드로어 사용.
5. 보안 및 데이터 처리 규칙 (Security & Data Handling Rules)
security.md의 핵심 내용을 AI가 코딩 시 즉시 적용할 수 있도록 요약합니다.
민감 정보 노출 금지: .env 파일의 시크릿 키를 클라이언트 컴포넌트('use client')에서 직접 참조하지 않습니다. 반드시 Server Action 또는 Route Handler를 통해 프록시합니다.
입력값 검증: 모든 API 엔드포인트(Route Handler)와 Server Action의 인자는 Zod 스키마로 1차 검증 후 처리합니다.
XSS 방지: dangerouslySetInnerHTML 사용 금지. 부득이한 경우 DOMPurify 사용 필수.
키오스크 유휴 타임아웃: 공용 화면 컴포넌트에는 useIdleTimer 훅을 적용하여 3분간 입력 없으면 세션 파기 및 로그인 화면 리다이렉트 로직을 포함해야 합니다.
6. 프로젝트 구조 및 파일 매핑 (Project Structure)
AI가 파일을 찾고 수정할 때 혼란을 방지하기 위한 표준 디렉토리 구조입니다.
/apps
  /core-platform        # 코어 플랫폼 (Next.js App Router)
    /app
      /(auth)           # 로그인, 회원가입 레이아웃
      /(dashboard)      # 앱 런처, 관리자 대시보드
      /apps/[slug]      # 서브 앱 Rewrite Catch-all 라우트
      /api              # Route Handlers
    /components
      /ui               # 공통 UI 컴포넌트 (Button, Card, Grid)
      /layout           # Shell, Sidebar, BottomNav
    /lib                # DB(Prisma), Auth, Utils
    /middleware.ts      # 🚨 핵심: Rewrite 및 SSRF 방어 로직
  /library              # 기존 라이브러리 앱 (basePath 설정)
  /aiplatform           # 기존 AI 앱
  /healthcare           # 기존 헬스케어 앱
/docs                   # prd.md, architect.md, security.md 등 모든 명세서
7. AI 에이전트 행동 강령 및 안티패턴 (Code of Conduct & Anti-patterns)
AI는 다음 안티패턴(Anti-pattern)을 절대 제안하거나 코딩하지 않아야 합니다.
🚫 안티패턴 (절대 금지)
✅ 올바른 패턴 (Must Do)
서브 앱 임베딩 시 <iframe src="..."> 사용
middleware.ts에서 NextResponse.rewrite() 사용
인증 토큰을 localStorage.setItem()으로 저장
cookies().set('session_token', ...) 사용 (HTTPOnly)
키오스크 대응을 위해 vw/vh만 사용
clamp(min, preferred, max)를 사용하여 최소/최대 크기 제한
API 요청 시 fetch('/api/...')에 절대 도메인 사용
상대 경로('/api/...') 사용하여 프록시 환경 대응
관리자 앱 등록 시 targetUrl을 그대로 Rewrite
ALLOWED_DOMAINS Allowlist 검증 후 Rewrite
정적 자산 경로에 절대 경로(/images/...) 하드코딩
basePath를 고려한 상대 경로 또는 assetPrefix 사용
8. 개발 시 참조해야 할 핵심 문서 (Reference Documents)
AI는 코드를 생성하기 전에 반드시 다음 문서들의 내용을 контек트로 파악하고 있어야 합니다.
architect.md: 시스템 전체 구성도 및 Middleware Rewrite 흐름도.
uiux.md: 다중 디바이스 브레이크포인트 및 4:5 그리드, 세로형 우선 규칙.
database.md: Prisma 스키마 및 테이블 관계 (User, Application, Permission).
security.md: SSRF 방지, CSP 헤더, HTTPOnly 쿠키, 키오스크 타임아웃 규칙.
interface.md: AppRegistry, ShellLayoutProps 등 TypeScript 타입 계약.
도메인 하드코딩 절대 금지: 코드 내에 rustkorea.cloud 또는 특정 도메인을 직접 입력하지 마십시오. 모든 도메인 참조는 process.env.NEXT_PUBLIC_PLATFORM_DOMAIN 또는 DB의 platform_settings 테이블에서 동적으로 가져와야 합니다.

선택적 확장: Multi-Tenant 구조가 필요하면 platform_settings 테이블과 tenant_id 컬럼을 Week 1에 함께 설계하십시오. (단일 도메인만 사용할 경우 생략 가능)
환경 변수 설정: .env에 NEXT_PUBLIC_PLATFORM_DOMAIN=rustkorea.cloud를 추가하고, 코드에서는 이 변수만 참조하도록 통일하십시오.
