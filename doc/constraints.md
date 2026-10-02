🚫 constraints.md (절대 제약사항 및 금지 규칙)
1. 문서 목적
이 문서는 RustKorea Unified Platform 프로젝트에서 기술적, 디자인적, 보안적, 운영적으로 절대 위반해서는 안 되는 Hard Constraints를 정의합니다. 모든 개발자, 디자이너, AI 에이전트는 이 문서를 최우선 규칙으로 따르며, 위반 사항 발견 시 즉시 수정해야 합니다.
2. 절대 금지 사항 (Hard Constraints - 위반 시 즉시 반려) 🚨
다음 항목은 어떤 상황에서도 예외를 인정하지 않으며, 위반 시 코드 리뷰에서 즉시 반려(Reject) 됩니다.
2.1. 기술적 절대 금지
	
금지 사항
이유
대안 (Must Do)
H1
<iframe>, <object>, <embed> 태그 사용
세션 단절, SEO 불가, 보안 취약, 키오스크 터치 이슈
middleware.ts의 NextResponse.rewrite() 사용
H2
인증 토큰을 localStorage, sessionStorage에 저장
XSS 공격 시 토큰 탈취 취약
HttpOnly, Secure, SameSite=strict 쿠키만 사용
H3
Next.js Pages Router (/pages) 사용
프로젝트 일관성 깨짐, RSC 활용 불가
App Router (/app)만 사용
H4
CSS-in-JS 라이브러리 (styled-components, emotion) 사용
번들 사이즈 증가, SSR 이슈, Tailwind와 충돌
Tailwind CSS만 사용
H5
API Route Handler에서 req.body를 검증 없이 사용
SQL Injection, XSS, 타입 오류 유발
Zod 스키마로 1차 검증 후 처리
H6
클라이언트 컴포넌트('use client')에서 .env 시크릿 직접 참조
환경 변수 노출 취약
Server Action 또는 Route Handler를 통해 프록시
2.2. 디자인/UI 절대 금지
#
금지 사항
이유
대안 (Must Do)
D1
가로형(Landscape) 우선 레이아웃 설계
키오스크와 모바일 사용성 저하
세로형(Portrait) 우선 설계, 가로형은 확장 형태로만
D2
아이콘 카드의 종횡비 임의 변경
시각적 일관성 깨짐, 피드 최적화 실패
반드시 aspect-[4/5] 비율 유지
D3
폰트 크기에 px 고정값만 사용
55인치 키오스크에서 글자 너무 작음, 모바일에서 너무 큼
clamp(min, preferred, max) 사용 필수
D4
터치 타겟(버튼, 아이콘) 크기 48x48px 미만
키오스크 오탐지, 모바일 불편
최소 min-h-[48px] min-w-[48px] 보장
D5
모바일에서 좌측 고정 사이드바 강제 표시
화면 공간 낭비, 콘텐츠 가독성 저하
모바일(<768px)에서는 하단 탭 바 또는 햄버거 드로어 사용
2.3. 보안 절대 금지
#
금지 사항
이유
대안 (Must Do)
S1
미들웨어 Rewrite 시 targetUrl을 검증 없이 전달
SSRF 공격 취약 (내부 네트워크 접근 가능)
ALLOWED_DOMAINS Allowlist 검증 필수
S2
CSP(Content Security Policy) 헤더 누락
XSS 공격 방어선 부재
엄격한 CSP 정책 적용 (security.md 참조)
S3
.env 파일을 Git에 커밋
시크릿 키 유출
.gitignore 등록, 시크릿 매니저 사용
S4
프로덕션 빌드에서 Source Map 활성화
소스 코드 역공학 취약
productionBrowserSourceMaps: false 설정
S5
키오스크 모드에서 유휴 타임아웃 미적용
무단 접근, 개인정보 노출 위험
useIdleTimer 훅으로 3분 타임아웃 강제
3. 기술적 제약 (Technical Constraints)
3.1. 프레임워크 및 언어
Next.js 버전: 14.0 이상 (App Router 필수)
TypeScript: Strict Mode 활성화 ("strict": true in tsconfig.json)
Node.js 버전: 20.x LTS 이상
3.2. 데이터베이스 및 ORM
DBMS: PostgreSQL 15 이상
ORM: Prisma ORM만 사용 (raw query 금지, 부득이한 경우 매개변수화된 쿼리만 허용)
마이그레이션: prisma migrate만 사용, 수동 SQL 실행 금지
3.3. 상태 관리
서버 상태: React Server Components(RSC) 기본, fetch 캐싱 활용
클라이언트 상태: Zustand 또는 React Context만 허용 (Redux, MobX 금지)
폼 상태: React Hook Form + Zod 조합만 사용
3.4. 애니메이션 및 인터랙션
라이브러리: Framer Motion만 사용 (GSAP, React Spring 금지)
성능 기준: 애니메이션은 GPU 가속(transform, opacity)만 사용, width, height, top, left 애니메이션 금지
4. 디자인/UI 제약 (Design Constraints)
4.1. 반응형 브레이크포인트 (Tailwind 기준)
/* Mobile First 접근 */
mobile:  < 768px   (기본값)
tablet:  >= 768px  (md:)
desktop: >= 1025px (lg:)
kiosk:   >= 1080px (xl:) - 세로형 키오스크 최적화
4.2. 타이포그래피 시스템 (clamp 필수)
/* 예시: 모든 텍스트는 clamp 사용 */
.text-heading-xl { font-size: clamp(32px, 4vw, 64px); }
.text-body-base  { font-size: clamp(16px, 2vw, 24px); }
.text-caption    { font-size: clamp(12px, 1.5vw, 18px); }
4.3. 색상 및 테마
다크 모드: 시스템 설정 따름 (prefers-color-scheme), 수동 전환 지원
컬러 팔레트: Tailwind extend를 통해 커스텀 색상만 사용, 임의의 HEX 값 직접 입력 금지
접근성: 모든 텍스트는 배경 대비 최소 4.5:1 명도비율 보장 (WCAG 2.1 AA)
4.4. 아이콘 및 이미지
아이콘 형식: SVG만 사용 (PNG, JPG 금지 - 해상도 독립성 보장)
이미지 최적화: Next.js <Image> 컴포넌트만 사용, <img> 태그 직접 사용 금지
애니메이션 아이콘: Lottie(JSON) 또는 SVG 애니메이션만 허용, GIF 금지
5. 보안 제약 (Security Constraints)
5.1. 인증 및 세션
쿠키 속성: 모든 인증 쿠키는 HttpOnly: true, Secure: true, SameSite: 'strict' 필수
세션 수명:
일반 사용자: 절대 만료 24시간, 유휴 만료 2시간
키오스크 모드: 유휴 만료 3분
비밀번호 해싱: bcrypt (cost factor 12 이상) 또는 Argon2id만 사용
5.2. API 보안
Rate Limiting:
인증 API (/api/auth/*): IP당 분당 5회
일반 API: IP당 분당 100회
CORS: Access-Control-Allow-Origin은 명시적으로 허용된 도메인만 지정, * 사용 금지
입력값 크기 제한: 요청 본문 최대 1MB, 파일 업로드 최대 10MB
5.3. 데이터 암호화
전송 계층: TLS 1.3 강제 (TLS 1.2는 레거시 지원 목적으로만 허용)
저장 계층: 민감 필드(주민번호, 연락처, 건강 데이터)는 AES-256-GCM으로 애플리케이션 레벨 암호화
백업: 모든 DB 백업은 암호화 후 저장, 복호화 키는 별도 관리
6. 성능 제약 (Performance Constraints)
6.1. 로딩 성능 (Lighthouse 기준)
LCP (Largest Contentful Paint): 1.5초 이하
FID (First Input Delay): 100ms 이하
CLS (Cumulative Layout Shift): 0.1 이하
TBT (Total Blocking Time): 200ms 이하
6.2. 미들웨어 성능
지연 시간: middleware.ts 실행 시간 10ms 이하 (Edge 환경 기준)
캐싱: 정적 자산은 최소 1년 (Cache-Control: public, max-age=31536000, immutable)
동적 데이터: stale-while-revalidate 전략 사용, 최대 캐시 수명 60초
6.3. 번들 사이즈
초기 JS 번들: 200KB 이하 (gzip 기준)
개별 페이지 번들: 100KB 이하
이미지: WebP 또는 AVIF 형식만 사용, 자동 최적화 필수
7. 운영/배포 제약 (Operational Constraints)
7.1. 배포 순서 및 의존성
코어 플랫폼 배포: 언제든 독립적으로 배포 가능
서브 앱 배포: 코어 플랫폼의 revalidatePath('/api/apps') 트리거 필수
DB 마이그레이션: 롤백 가능한 스크립트 작성 필수, 파괴적 변경(DROP TABLE 등)은 별도 승인 필요
7.2. 환경 변수 관리
로컬 개발: .env.local 사용 (Git 추적 금지)
스테이징/프로덕션: Vercel Environment Variables 또는 AWS Secrets Manager 사용
시크릿 회전: 90일마다 자동 회전 정책 적용
7.3. 모니터링 및 로깅
에러 추적: Sentry 연동 필수 (소스 맵 업로드 포함)
성능 모니터링: Vercel Analytics 또는 Prometheus + Grafana
감사 로그: 모든 관리자 액션은 변경 불가능한 형태로 최소 1년 보관
8. 위반 시 대응 프로세스 (Violation Response Process)
8.1. 위반 발견 시
즉시 코드 리뷰 반려: 위반 사항을 댓글로 명시하고 수정 요청
심각도 평가:
Critical (H1~H5, S1~S5): 즉시 수정, 배포 차단
Major (기대 기술/디자인 제약): 다음 스프린트 내 수정
Minor (권고 사항): 점진적 개선
재발 방지: agent.md 또는 constraints.md에 규칙 추가, 팀 공유
8.2. 예외 승인 프로세스
부득이하게 제약사항을 위반해야 하는 경우:
예외 요청서 작성: 위반 항목, 이유, 대안, 위험 평가 작성
개발 총 책임자 승인: 서면 승인 필요
문서화: exceptions.md에 기록, 정기적 재평가
9. 제약사항 체크리스트 (Pre-Commit Checklist)
개발자는 코드를 커밋하기 전에 다음 항목을 반드시 확인해야 합니다.
iframe, localStorage 토큰 저장, Pages Router 사용하지 않았는가?
모든 폰트 크기에 clamp()를 적용했는가?
아이콘 카드가 aspect-[4/5] 비율을 유지하는가?
터치 타겟이 최소 48x48px 이상인가?
미들웨어 Rewrite 시 Allowlist 검증을 거쳤는가?
모든 API 요청을 Zod로 검증했는가?
.env 파일이 Git에 포함되지 않았는가?
프로덕션 빌드에서 Source Map이 비활성화되었는가?
키오스크 모드에서 유휴 타임아웃이 적용되었는가?
Lighthouse 성능 점수가 90점 이상인가?
🛡️ 개발 총 책임자의 최종 지시
이 constraints.md는 프로젝트의 품질과 일관성을 보장하는 방패입니다. 개발 팀은 이 문서를 매일 참조하며, AI 에이전트는 agent.md와 함께 이 문서를 학습하여 코드를 생성해야 합니다.
제약사항은 자유를 제한하는 것이 아니라, 상업적으로 판매 가능한 엔터프라이즈급 제품의 최소 요건을 정의하는 것입니다. 이 규칙들을 철저히 준수할 때만, 귀하의 플랫폼은 시장에서 신뢰받고 장기적으로 성공할 수 있습니다.
#
금지 사항
이유
대안
H7
코드 내 특정 도메인(rustkorea.cloud 등) 하드코딩
다중 도메인/테넌시 확장 불가
환경 변수 또는 DB 설정 기반 동적 참조
H8
window.location.hostname 기반 분기 로직
SSR 환경에서 오류 발생
Next.js headers() 또는 미들웨어에서 Host 처리
