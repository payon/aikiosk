📜 [부록 A] AI 코드 생성 및 개발자를 위한 절대 제약사항 (Anti-Hallucination Constraints)
문서 목적: 본 제약사항은 AI 코딩 에이전트(GPT, Claude, Copilot 등)와 인간 개발자가 이 명세서를 기반으로 코드를 생성할 때, 환각(Hallucination)으로 인한 오류, 존재하지 않는 API 사용, 임의의 스펙 확장, 보안 우회를 원천 차단하기 위한 절대적 규칙集입니다. 이 문서는 명세서의 모든 코드 생성에 앞서 선행되어 읽혀야 합니다.
1. 철학 및 기본 원칙 (Fundamental Principles)
1.1 "모르는 것은 모른다고 말하라" 원칙
명세서에 명시되지 않은 기능, API, 라이브러리 메서드는 절대 상상하여 사용하지 말 것
불확실한 경우 코드를 생성하지 말고 // TODO: 명세서에 명시되지 않은 기능 - 확인 필요 주석과 함께 중단할 것
"이렇게 하면 될 것 같다"는 추측성 코드는 모두 금지
1.2 "명세서가 곧 법" 원칙
본 명세서(v5.0)와 [부록 A]의 규칙이 충돌할 경우, 명세서가 우선
단, 보안/접근성 관련 제약사항은 명세서보다 강하게 적용
명세서에 없는 필드/타입/액션을 임의로 추가하는 것은 명백한 위반
1.3 "검증 가능한 코드만" 원칙
모든 생성 코드는 컴파일 타임 또는 런타임에 즉시 검증 가능해야 함
"나중에 테스트하면 되겠지"라는 코드는 생성 금지
Rust의 경우 cargo check 통과, TypeScript의 경우 tsc --noEmit 통과가 선행 조건
2. 기술 스택 절대 제약 (Technology Stack Constraints)
2.1 백엔드 (Rust)
항목
허용
금지
프레임워크
Axum 0.7.x
Actix-web, Rocket, Warp
비동기 런타임
Tokio 1.x
async-std, smol
ORM/DB
SQLx 0.8.x (PostgreSQL/SQLite)
Diesel, SeaORM (단, 읽기 전용 조회는 SeaORM 허용)
직렬화
Serde 1.x + serde_json
bincode, MessagePack (API 통신 시)
에러 처리
thiserror + anyhow
임의의 panic!() 사용
로깅
tracing + tracing-subscriber
log 크레이트 직접 사용
HTTP 클라이언트
reqwest 0.11.x
hyper 직접 사용, ureq
🚫 할루네이션 금지 항목:
axum::extract::Query의 존재하지 않는 메서드 호출 금지
sqlx::query! 매크로에서 존재하지 않는 컬럼 참조 금지
tokio::spawn의 반환값을 무시하는 코드 금지
serde_json::Value를 실제 타입 없이 사용 금지 (반드시 구조체 정의)
2.2 프론트엔드 (React)
항목
허용
금지
프레임워크
React 18.x + TypeScript 5.x
Vue, Svelte, Angular
상태관리
Zustand 4.x + React Query 5.x
Redux, MobX, Recoil
DnD
@dnd-kit/core 6.x
react-beautiful-dnd, react-dnd
스타일링
Tailwind CSS 3.x
styled-components, Emotion
차트
Recharts 2.x (관리자), 경량 SVG (키오스크)
D3.js 직접 사용, Chart.js
폼
React Hook Form 7.x + Zod
Formik, Redux Form
API
Fetch API 또는 ky
axios (일관성 유지)
🚫 할루네이션 금지 항목:
useDrag, useDrop의 존재하지 않는 옵션 전달 금지
Tailwind 클래스 중 존재하지 않는 유틸리티 사용 금지
React Query의 useQuery에 존재하지 않는 옵션(keepAlive 등) 사용 금지
Zustand 미들웨어의 실제 존재하지 않는 함수 호출 금지
2.3 클라이언트 (Tauri 2)
항목
허용
금지
Tauri 버전
Tauri 2.x (stable)
Tauri 1.x, 베타 API
플러그인
공식 플러그인만 (tauri-plugin-sql, tauri-plugin-store 등)
서드파티 검증되지 않은 플러그인
로컬 DB
SQLite (via tauri-plugin-sql)
IndexedDB 직접 사용, LevelDB
하드웨어
serialport 5.x, rdev 0.x
임의의 FFI 라이브러리
🚫 할루네이션 금지 항목:
tauri::command 매크로에 존재하지 않는 속성 사용 금지
Tauri 2에서 제거된 1.x API (tauri::api::path 등) 사용 금지
invoke() 호출 시 존재하지 않는 Rust 함수 이름 참조 금지
Android Tauri 지원 기능을 베타 상태로 가정하고 사용 금지
2.4 데이터베이스 (PostgreSQL)
항목
허용
금지
버전
PostgreSQL 15.x 이상
13 이하
기능
RLS, JSONB, Time-series Partitioning
임의의 확장(extension) 설치
쿼리
파라미터화된 쿼리만
Raw String Interpolation
🚫 할루네이션 금지 항목:
존재하지 않는 PostgreSQL 함수 (array_agg_custom() 등) 사용 금지
RLS 정책에서 존재하지 않는 시스템 변수 참조 금지
JSONB 연산자(->>, @>)의 잘못된 사용법 적용 금지
3. 데이터 구조 절대 제약 (Data Structure Constraints)
3.1 JSON 스키마 필드명 불변성
❌ 절대 금지:
- 명세서에 정의된 필드명의 임의 변경 (예: "templateId" → "tpl_id")
- snake_case와 camelCase 혼용
- 필드명 오타 허용 (컴파일/런타임 검증 필수)

✅ 필수 준수:
- 모든 필드명은 명세서의 정확한 표기법 따를 것
- 새로운 필드 추가 시 반드시 `customExtensions` 섹션 사용
- enum 값은 명세서 정의된 값만 사용 (임의 확장 금지)

3.2 타입 안전성 (Type Safety)
// ❌ 금지: 임의의 any/Value 사용
fn process(data: serde_json::Value) { ... }

// ✅ 필수: 명확한 구조체 정의
#[derive(Debug, Serialize, Deserialize)]
struct TemplateMetadata {
    template_id: String,
    tenant_id: String,
    // ... 명세서에 정의된 모든 필드
}
fn process(data: TemplateMetadata) { ... }

3.3 시각적 SQL 제약
❌ 절대 금지:
- visualQuery를 Raw SQL 문자열로 변환 시 String interpolation 사용
- 존재하지 않는 테이블/컬럼명 참조
- SQL 인젝션 가능성이 있는 동적 쿼리 생성

✅ 필수 준수:
- 모든 파라미터는 `$1`, `$2` 형태의 바인딩 사용
- 테이블/컬럼명은 화이트리스트 검증 필수
- `{{CURRENT_TENANT_ID}}` 같은 템플릿 변수만 동적 값으로 허용

4. 보안 절대 제약 (Security Constraints)
4.1 멀티테넌시 격리 (Zero-Trust)
// ❌ 절대 금지: tenant_id 필터링 누락
async fn get_templates(pool: &PgPool) -> Vec<Template> {
    sqlx::query_as("SELECT * FROM templates").fetch_all(pool).await // ⚠️ 치명적 오류
}

// ✅ 필수: 모든 쿼리에 tenant_id 포함 또는 RLS 의존
async fn get_templates(pool: &PgPool, tenant_id: Uuid) -> Vec<Template> {
    sqlx::query_as("SELECT * FROM templates WHERE tenant_id = $1")
        .bind(tenant_id)
        .fetch_all(pool)
        .await
}
🚫 할루네이션 금지 항목:
"테스트 편의상" tenant_id 필터링 생략 금지
슈퍼관리자 권한을 일반 API에서 가정하고 구현 금지
JWT 검증 로직을 임의로 단순화 금지

4.2 인증 및 권한
❌ 절대 금지:
- 비밀번호 평문 저장
- JWT secret을 코드에 하드코딩
- CORS를 `*`로 설정 (프로덕션)
- Rate Limiting 없이 공개 API 노출

✅ 필수 준수:
- 비밀번호: Argon2id 해싱
- JWT secret: 환경 변수 또는 시크릿 관리자
- CORS: 명시적 도메인 화이트리스트
- 모든 공개 API: 기본 Rate Limiting 적용

4.3 하드웨어 보안
❌ 절대 금지:
- 하드웨어 드라이버 설정을 클라이언트 측에서 임의 수정 가능하게 노출
- 시리얼 포트 경로를 사용자 입력으로 직접 사용 (경로 순회 취약점)
- 결제 시뮬레이션 데이터를 로그에 평문 저장

✅ 필수 준수:
- 드라이버 설정은 서버에서 서명된 값만 허용
- 포트 경로는 화이트리스트 기반 검증
- 결제 데이터는 마스킹 또는 휘발성 메모리 처리

5. 접근성 절대 제약 (Accessibility Constraints)
5.1 WCAG 준수 강제
❌ 절대 금지:
- minTouchTarget을 64px 미만으로 설정하는 코드
- 색상 대비율을 4.5:1 미만으로 허용하는 UI
- TTS 라벨 없이 상호작용 컴포넌트 렌더링
- 키보드 포커스 아웃라인 제거

✅ 필수 준수:
- 모든 버튼/카드: 최소 64x64px
- 텍스트: 최소 24px (15인치 기준)
- 대비율: WCAG AA (4.5:1) 이상, 시니어 모드 AAA (7:1) 권장
- 모든 상호작용 요소: `ttsLabel` 필수

5.2 접근성 검증 우회 금지
// ❌ 금지: 검증 로직 우회
if (process.env.NODE_ENV === 'development') {
  skipAccessibilityValidation(); // ⚠️ 절대 금지
}

// ✅ 필수: 검증은 항상 실행, 환경에 따라 로깅 레벨만 변경
const result = await validateAccessibility(schema);
if (!result.passed) {
  if (process.env.NODE_ENV === 'production') {
    throw new PublishBlockedError(result.errors);
  } else {
    console.warn('Accessibility warnings:', result.warnings);
  }
}

6. 성능 절대 제약 (Performance Constraints)
6.1 응답 시간
엔드포인트
최대 응답 시간
금지 사항
템플릿 목록 조회
500ms
N+1 쿼리, 전체 데이터 로드
템플릿 JSON 저장
2초
동기 파일 I/O, 대용량 메모리 적재
키오스크 Heartbeat
100ms
DB 직접 조회 (Redis 캐시 필수)
통계 대시보드
3초
실시간 집계 (Materialized View 필수)

6.2 메모리 사용
❌ 절대 금지:
- 키오스크 클라이언트에서 전체 템플릿 에셋을 메모리에 로드
- Rust에서 `Vec::with_capacity(1_000_000)` 같은 과도한 사전 할당
- React에서 불필요한 큰 상태 객체 매 렌더링마다 재생성

✅ 필수 준수:
- 에셋은 스트리밍 또는 청크 단위로 로드
- 대용량 데이터는 Iterator/Stream 처리
- React 상태는 `useMemo`, `useCallback`으로 최적화

6.3 오프라인 큐잉
❌ 절대 금지:
- 로컬 SQLite에 이벤트 무한 적재 (메모리/디스크 고갈)
- 동기화 실패 시 무한 재시도 (서버 과부하)

✅ 필수 준수:
- pending_events 테이블: 최대 10,000건, 초과 시 오래된 이벤트 폐기
- 재시도: 지수 백오프 (1분 → 5분 → 15분), 최대 5회
- 7일 이상 동기화 실패 이벤트: 자동 폐기 및 관리자 알림

7. AI 코드 생성 특별 제약 (AI-Specific Anti-Hallucination Rules)
7.1 코드 생성 전 필수 확인 사항
AI 에이전트는 코드를 생성하기 전에 다음을 반드시 확인해야 함:

1. [ ] 사용하려는 라이브러리/크레이트가 명세서에 명시되었는가?
2. [ ] 사용하려는 함수/메서드가 공식 문서에 존재하는가?
3. [ ] 데이터 구조가 명세서의 JSON 스키마와 정확히 일치하는가?
4. [ ] 보안 규칙(RLS, tenant_id, JWT)을 준수하는가?
5. [ ] 접근성 규칙(터치 타겟, TTS, 대비율)을 준수하는가?

하나라도 "아니오"이면 → 코드 생성 중단하고 사용자에게 확인 요청

7.2 불확실성 표현 의무
// ❌ 금지: 확신 없는 코드를 자신있게 작성
pub fn mysterious_function() -> Result<(), Error> {
    // 실제 존재하지 않을 수 있는 API 호출
    some_crate::uncertain_method()?;
}

// ✅ 필수: 불확실하면 명시
pub fn mysterious_function() -> Result<(), Error> {
    // FIXME: some_crate::uncertain_method의 존재 여부 확인 필요
    // 공식 문서: https://docs.rs/some_crate/...
    // 확인 전까지 이 함수는 컴파일되지 않도록 의도적 오류 발생
    unimplemented!("확인 필요: some_crate::uncertain_method")
}

7.3 공식 문서 참조 의무
AI가 코드를 생성할 때, 다음 URL을 반드시 참조하여 정확성을 검증해야 함:

- Rust Axum: https://docs.rs/axum/latest/axum/
- SQLx: https://docs.rs/sqlx/latest/sqlx/
- Tauri 2: https://v2.tauri.app/reference/
- React 18: https://react.dev/reference/react
- Zustand: https://docs.pmnd.rs/zustand/getting-started/introduction
- @dnd-kit: https://docs.dndkit.com/
- Tailwind CSS: https://tailwindcss.com/docs
- PostgreSQL 15: https://www.postgresql.org/docs/15/

명세서와 공식 문서가 충돌할 경우 → 사용자에게 충돌 사항 보고

7.4 테스트 코드 필수 포함
AI가 기능 코드를 생성할 때, 반드시 다음을 포함해야 함:

1. 단위 테스트 (최소 1개): 핵심 로직 검증
2. 경계값 테스트 (최소 1개): null, 빈 배열, 최대값 등
3. 오류 케이스 테스트 (최소 1개): 실패 시나리오

테스트 코드 없이는 기능 코드를 완성된 것으로 간주하지 않음

8. 문서화 절대 제약 (Documentation Constraints)
8.1 코드 주석
// ❌ 금지: 의미 없는 주석
let x = 5; // x에 5를 할당

// ✅ 필수: "왜"에 대한 설명
// 시니어 사용자의 실수 방지를 위해 세션 타임아웃을 60초로 제한
// (참고: WCAG 2.1 AAA 권장사항 기반)
const SESSION_TIMEOUT_SEC: u64 = 60;

8.2 README 및 API 문서
모든 모듈은 다음을 포함하는 README.md를 필수로 가질 것:

1. 목적 (Purpose): 이 모듈이 왜 존재하는가
2. 의존성 (Dependencies): 어떤 외부 라이브러리에 의존하는가
3. 사용 예시 (Usage): 최소 1개의 동작하는 예제
4. 제약사항 (Constraints): 이 모듈의 절대적 제한 사항
5. 테스트 방법 (Testing): 어떻게 테스트하는가

9. 위반 시 처리 절차 (Violation Handling)
9.1 위반 감지
코드 리뷰 또는 CI/CD 파이프라인에서 다음을 자동 감지:

1. 정적 분석 도구 (Clippy, ESLint)
2. 타입 체커 (tsc, cargo check)
3. 보안 스캐너 (cargo-audit, npm audit)
4. 접근성 검증기 (axe-core, custom validator)
5. 명세서 일치 검증기 (custom JSON Schema validator)

9.2 위반 처리

위반 사항 심각도별 처리:

🔴 CRITICAL (즉시 차단):
- 멀티테넌시 격리 위반
- SQL 인젝션 가능성
- 접근성 검증 우회
→ PR 머지 불가, 즉시 수정

🟡 HIGH (24시간 내 수정):
- 성능 제약 위반
- 테스트 커버리지 미달
- 문서화 누락
→ PR 머지 가능하지만 이슈 트래킹 필수

🟢 MEDIUM (다음 스프린트 내 수정):
- 코드 스타일 위반
- 주석 부족
- 최적화 기회
→ 이슈 등록 후 점진적 개선

10. 총괄 PM의 최종 선언
본 [부록 A]의 모든 제약사항은 협상 불가능(Non-negotiable) 합니다.
AI 에이전트든 인간 개발자든, 이 문서를 읽고 코드를 생성할 때 다음 3가지를 반드시 명심하십시오:
"모르면 만들지 마라" - 존재하지 않는 기능의 상상은 이 프로젝트의 치명적 결함이 됩니다.
"명세서가 곧 법이다" - 임의의 확장은 시스템을 파괴합니다.
"검증 없이는 완료 없다" - 테스트와 문서화는 선택이 아닌 필수입니다.
