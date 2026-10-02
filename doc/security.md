📁 11. security.md (상용급 보안 아키텍처 및 가이드라인)
1. 보안 원칙 (Security Principles)
Zero Trust (제로 트러스트): 내부 네트워크라 해도 모든 요청은 검증되어야 합니다.
Defense in Depth (심층 방어): 단일 보안 장치에 의존하지 않고, 프론트엔드, 미들웨어, API, DB, 인프라 전 단계에 보안 계층을 중첩합니다.
Least Privilege (최소 권한의 원칙): 사용자, 서비스, DB 계정은 작업에 필요한 최소한의 권한만 가집니다.
2. 인증 및 세션 관리 (Authentication & Session Management)
단일 도메인 기반 SSO의 핵심은 세션 쿠키의 안전한 관리입니다.
HTTPOnly & Secure Cookies: 인증 토큰(JWT 또는 세션 ID)은 절대 localStorage나 sessionStorage에 저장하지 않습니다. 반드시 HttpOnly: true, Secure: true 속성을 가진 쿠키로만 관리하여 XSS 공격 시 토큰 탈취를 원천 차단합니다.
SameSite 속성: 단일 도메인(rustkorea.cloud) 내에서 모든 라우팅이 이루어지므로, CSRF 공격 방지를 위해 SameSite: 'strict'를 기본으로 적용합니다.
세션 수명 및 키오스크 대응:
일반 사용자: 절대 세션 만료 시간 24시간, 유휴 시간(Idle Timeout) 2시간.
키오스크 공용 모드: 3분간 입력이 없으면 자동으로 세션을 파기하고 로그인 화면으로 리다이렉트하는 useIdleTimer 훅을 코어 셸 레이아웃에 강제 적용합니다.
비밀번호 정책: bcrypt 또는 Argon2를 사용한 솔트(Salt) 해싱 적용, 최소 8자리 이상(영문, 숫자, 특수문자 혼합) 강제.
3. 네트워크 및 전송 계층 보안 (Network & Transport Security)
TLS 1.3 강제: 모든 통신은 HTTPS(TLS 1.2 이상, 권장 1.3)만 허용합니다. HTTP 요청은 HTTPS로 영구 리다이렉트(301)합니다.
HSTS (HTTP Strict Transport Security): 미들웨어 또는 웹 서버(Nginx/Vercel) 레벨에서 Strict-Transport-Security: max-age=31536000; includeSubDomains; preload 헤더를 적용하여 다운그레이드 공격을 방지합니다.
Content Security Policy (CSP): XSS 공격 방지를 위한 핵심 방어선입니다. 코어 플랫폼에서 다음과 같은 엄격한 CSP를 적용합니다.
http

123456789
4. API 및 미들웨어 보안 (API & Middleware Security)
이 아키텍처의 가장 중요한 보안 포인트는 미들웨어 Rewrite와 동적 앱 등록 과정입니다.
SSRF (Server-Side Request Forgery) 방지:
관리자가 앱 등록 시 targetUrl을 입력할 수 있지만, 미들웨어는 허용된 도메인 목록(Allowlist) 과만 매칭합니다.
예: targetUrl이 https://*.rustkorea.cloud 또는 사전 등록된 내부 IP 대역이 아닌 경우(예: http://localhost, http://169.254.169.254 등 클라우드 메타데이터 서비스), 미들웨어에서 즉시 차단하고 403 Forbidden을 반환합니다.
Rate Limiting (속도 제한):
/api/auth/* (로그인, 토큰 갱신): IP당 분당 5회 제한.
/api/apps 및 일반 API: IP당 분당 100회 제한. (Upstash Redis 또는 Vercel KV 활용).
입력값 검증 (Input Validation): 모든 API 엔드포인트는 Zod 또는 Joi를 사용하여 요청 스키마를 엄격하게 검증합니다. 허용되지 않은 필드는 즉시 거부합니다.
5. 프론트엔드 보안 (Frontend Security)
XSS (Cross-Site Scripting) 방지: Next.js는 기본적으로 React의 자동 이스케이프를 제공하지만, dangerouslySetInnerHTML 사용은 원칙적으로 금지합니다. 부득이한 경우 DOMPurify 라이브러리를 통해 반드시 샌디타이징(Sanitization)을 거칩니다.
의존성 보안 (Supply Chain Security):
npm audit 또는 Snyk를 CI 파이프라인에 통합하여 알려진 취약점(Vulnerability)이 있는 패키지의 병합을 차단합니다.
package.json의 의존성 버전을 고정(Pinning)하여 예기치 않은 악성 업데이트를 방지합니다.
민감 정보 노출 방지: 소스 맵(Source Map)은 프로덕션 빌드에서 비활성화(productionBrowserSourceMaps: false)하며, 콘솔 로그(console.log)는 빌드 시 제거합니다.
6. 데이터베이스 및 데이터 보안 (Database & Data Security)
특히 healthcare 앱과 연계될 경우 개인정보보호법(PIPA) 및 의료법 준수가 필수적입니다.
저장 데이터 암호화 (Encryption at Rest): PostgreSQL 데이터베이스 디스크 수준 암호화를 활성화합니다. 민감한 필드(예: 사용자 실명, 연락처, 건강 데이터)는 애플리케이션 레벨에서 AES-256-GCM으로 추가 암호화하여 저장합니다.
ORM 보안: Prisma ORM을 사용하여 SQL Injection을 원천 차단합니다. raw query 사용은 금지하며, 부득이한 경우 매개변수화된 쿼리(Parameterized Query)만 허용합니다.
데이터 마스킹 (Data Masking): 관리자 대시보드에서 민감한 개인정보(주민등록번호, 전화번호 등)를 조회할 때는 중간 자리를 마스킹(010-****-1234)하여 표시하고, 전체 조회 시에는 별도의 감사 로그(Audit Log)를 기록합니다.
7. 인프라 및 배포 보안 (Infrastructure & Deployment Security)
환경 변수 관리: .env 파일은 절대 Git에 커밋하지 않습니다. Vercel Environment Variables, AWS Secrets Manager 또는 HashiCorp Vault를 사용하여 런타임에 주입합니다.
WAF (Web Application Firewall): Cloudflare 또는 AWS WAF를 도메인 앞에 배치하여 SQLi, XSS, 악성 봇 트래픽, DDoS 공격을 엣지 단계에서 차단합니다.
컨테이너 보안 (Docker/K8s 사용 시):
루트(root) 사용자가 아닌 비특권 사용자(non-root user)로 컨테이너를 실행합니다.
정기적으로 컨테이너 이미지 취약점 스캔(Trivy 등)을 수행합니다.
8. 모니터링, 로깅 및 규정 준수 (Monitoring, Logging & Compliance)
중앙화된 로깅: 모든 인증 시도(성공/실패), 권한 변경, 앱 등록/삭제 이력은 변경 불가능한(Immutable) 형태로 중앙 로그 서버(ELK Stack 또는 Datadog)에 전송됩니다.
보안 감사 로그 (Audit Trail): 관리자 행위는 반드시 who (누가), when (언제), what (무엇을), result (성공/실패) 형태로 기록되어 최소 1년 이상 보관합니다.
규정 준수:
한국 개인정보보호법(PIPA) 및 정보통신망법 준수를 위한 개인정보 처리방침 동의 프로세스 구현.
헬스케어 데이터 처리 시 가명처리 또는 익명화 가이드라인 준수.
9. 보안 점검 체크리스트 (Security Audit Checklist)
개발 팀은 다음 항목을 출시 전 반드시 체크하고 서명해야 합니다.
모든 쿠키에 HttpOnly, Secure, SameSite=strict가 설정되었는가?
미들웨어 Rewrite 로직에 targetUrl Allowlist 검증이 포함되어 있는가? (SSRF 방지)
프로덕션 환경에서 .env 파일이 노출되지 않고, 시크릿 매니저를 사용하는가?
CSP 헤더가 올바르게 설정되어 인라인 스크립트 실행이 차단되는가?
키오스크 모드에서 유휴 시간(Idle Timeout) 자동 로그아웃이 정상 작동하는가?
모든 API 엔드포인트에 인증(Authentication) 및 인가(Authorization) 미들웨어가 적용되었는가?
종속성 패키지 취약점(npm audit)이 0건(Critical/High)인가?
관리자 액션(앱 추가/삭제)에 대한 감사 로그(Audit Log)가 기록되는가?
