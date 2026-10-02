# 기술 스택 및 구현 가이드

## 1. Backend (Rust)
- **Framework**: Axum (비동기, 경량, 탁월한 미들웨어 지원)
- **Database**: SQLx (PostgreSQL, 컴파일 타임 쿼리 검증) + SeaORM (선택적, 복잡한 관계 관리 시)
- **Auth**: JWT (jsonwebtoken crate)
- **Real-time**: Tokio + Tokio-Tungstenite (WebSocket) 또는 Rumqttc (MQTT)

## 2. Frontend (Admin & Client)
- **Framework**: React 18 + TypeScript + Vite
- **State Management**: Zustand (경량, 보일러플레이트 최소화)
- **DnD Editor**: `@dnd-kit/core` 또는 GrapesJS (커스텀 블록 빌더)
- **Styling**: Tailwind CSS (반응형 유틸리티 클래스로 15/21/32인치 대응 용이)

## 3. Desktop Client (Tauri 2)
- **Core**: Rust (하드웨어 연동, 로컬 캐시 관리)
- **Webview**: WebView2 (Windows), WebKitGTK (Linux)
- **Plugin**: `tauri-plugin-store` (설정 저장), `tauri-plugin-shell` (프린터 명령 실행)

## 4. Android Client (TWA)
- **Tool**: Bubblewrap CLI
- **Hosting**: PWA를 서브도메인에 호스팅하고, TWA 래퍼 앱으로 Play Store 배포.

# [프롬프트 목표] 각 레이어에서 사용할 구체적인 기술 스택과 구현 가이드라인을 정의한다.

## 1. Backend (Rust)
- **Web**: Axum + Tower (미들웨어: CORS, Rate Limiting, Tenant Extraction)
- **DB**: SQLx (PostgreSQL/SQLite, 컴파일 타임 쿼리 검증)
- **Async**: Tokio
- **Serialization**: Serde (JSON 스키마 검증에 `schemars` 크레이트 활용)

## 2. Frontend (React Admin)
- **State**: Zustand (전역 상태), React Query (서버 상태 및 캐싱)
- **DnD**: `@dnd-kit/core` (접근성 지원이 뛰어난 드래그앤드롭 라이브러리)
- **Charts**: `recharts` 또는 `echarts-for-react` (반응형 및 경량화 옵션 지원)

## 3. Kiosk Client (Tauri 2)
- **Local DB**: `tauri-plugin-sql` (SQLite) - 오프라인 설문 큐잉용.
- **Hardware**: `serialport` (프린터), `rdev` (전역 키보드/물리 버튼 훅)
- **Sync Worker**: 백그라운드 스레드에서 30초마다 네트워크 상태 확인 및 SQLite 큐 전송 처리.

- **Dynamic Resolver**: Rust `sqlx::Any` 또는 동적 쿼리 빌더를 활용하여 JSON 스키마 기반의 실시간 데이터 조회 구현.
- **State Management**: Tauri 내부 Rust 상태 관리를 위해 `tauri-plugin-store` 또는 경량 인메모리 DB(Redis-like) 구조 채택.

📋 [프로그램 명세서 v1.0] 키오스크 비즈니스 OS - 메타 템플릿 데이터 구조 완전 명세
문서 목적: 본 명세서는 키오스크 비즈니스 OS의 핵심 두뇌인 '메타 템플릿 JSON 스키마'를 정의합니다. 이 문서를 바탕으로 백엔드(Rust/Axum), 프론트엔드(React 에디터), 클라이언트(Tauri 2)가 일관된 데이터 구조를 공유하며, 향후 5년간의 확장성까지 고려한 완전한 명세입니다.
1. 설계 원칙 및 철학
1.1 핵심 설계 원칙
단일 진리 공급원 (Single Source of Truth): 하나의 JSON 스키마가 에디터, 서버, 클라이언트 모두에서 해석되는 표준
계층적 분리 (Layered Separation): 데이터 / UI / 로직 / 하드웨어 / 배포 레이어가 명확히 구분되어 독립적 진화 가능
확장성 우선 (Extensibility First): 새로운 산업군, 컴포넌트, 데이터 소스 추가 시 기존 스키마를 깨지 않고 확장
버전 호환성 (Version Compatibility): 스키마 버전 관리를 통해 구버전 템플릿도 신버전 엔진에서 해석 가능
검증 가능성 (Validatability): JSON Schema 또는 Rust 구조체로 컴파일 타임/런타임 검증 가능
1.2 참조 아키텍처
Xibo CMS: Layout → Region → Media 계승 → Page → Component → Dataset으로 재정의
SmartBig 플랫폼: 시각적 데이터 모델링 → Visual SQL Builder로 구현
FlutterFlow: 노드 기반 액션 체인 → Action Chain Builder로 구현
Figma: 컴포넌트 속성 패널 → Property Panel Binding으로 구현

2. 스키마 버전 관리 전략
2.1 버전 정책
{
  "schemaVersion": "2.1.0",  // Major.Minor.Patch
  "engineCompatibility": "^2.0.0",  // 호환되는 엔진 버전
  "createdAt": "2026-09-22T10:30:00Z",
  "lastModifiedAt": "2026-09-22T14:45:00Z"
}

2.2 버전별 호환성 규칙
Major (2.x.x → 3.x.x): 하위 호환성 깨짐, 마이그레이션 스크립트 필수
Minor (2.0.x → 2.1.x): 선택적 필드 추가, 구버전 엔진도 해석 가능
Patch (2.1.0 → 2.1.1): 버그 수정, 스키마 변화 없음
2.3 마이그레이션 체인
v1.0 템플릿 → [v1.0→v2.0 변환기] → v2.0 템플릿 → [v2.0→v2.1 변환기] → v2.1 템플릿

3. 최상위 구조 (Root Schema)
3.1 전체 트리 구조
KioskTemplate (Root)
├── schemaVersion (string, required)
├── engineCompatibility (string, required)
├── metadata (object, required)
│   ├── templateId (string, UUID)
│   ├── tenantId (string, UUID)
│   ├── name (string)
│   ├── description (string)
│   ├── industry (enum: CAFE, LIBRARY, TRANSPORT, HEALTHCARE, EDUCATION, PUBLIC)
│   ├── tags (array of string)
│   ├── thumbnailUrl (string)
│   └── createdAt, updatedAt (datetime)
├── accessibility (object, required)
│   ├── validated (boolean)
│   ├── validationRules (object)
│   └── validationReport (array)
├── deployment (object, required)
│   ├── status (enum: DRAFT, PUBLISHED, ARCHIVED)
│   ├── version (string, semver)
│   ├── targetDevices (array of enum)
│   ├── publishedAt (datetime)
│   └── publishedBy (string, userId)
├── globalState (object, required)
│   ├── initialValues (object)
│   ├── sessionConfig (object)
│   └── persistenceConfig (object)
├── datasets (array, required)
│   └── [DatasetDefinition]
├── pages (array, required)
│   └── [PageDefinition]
├── widgets (array, optional)
│   └── [WidgetDefinition]
├── actionChains (object, required)
│   └── { [chainId]: ActionChainDefinition }
├── hardwareBindings (object, optional)
│   └── { [bindingId]: HardwareBindingDefinition }
└── customExtensions (object, optional)
    └── { [extensionKey]: any }

4. 메타데이터 섹션 (metadata)
4.1 필드 명세
필드명
타입
필수
설명
예시
templateId
string (UUID)
✅
템플릿 고유 식별자
"tpl_cafe_001"
tenantId
string (UUID)
✅
소속 테넌트 (센터/지역)
"tenant_seoul_a"
name
string
✅
템플릿 표시 이름
"시니어 카페 주문 키오스크"
description
string
❌
상세 설명
"아메리카노, 라떼 등 시니어 친화적 메뉴"
industry
enum
✅
산업군 분류
"CAFE"
tags
array[string]
❌
검색/필터용 태그
["시니어", "카페", "주문"]
thumbnailUrl
string
❌
미리보기 썸네일 URL
"https://cdn.../thumb.jpg"
author
object
✅
작성자 정보
{ "userId": "u_001", "name": "김관리" }
createdAt
datetime
✅
생성 시각
"2026-09-22T10:30:00Z"
updatedAt
datetime
✅
마지막 수정 시각

4.2 industry enum 상세
enum Industry {
  CAFE = "CAFE",                    // 무인 카페, 테이블오더
  RESTAURANT = "RESTAURANT",        // 패스트푸드, 푸드코트
  LIBRARY = "LIBRARY",              // 스마트 도서관
  TRANSPORT = "TRANSPORT",          // 열차, 고속버스, 공항
  HEALTHCARE = "HEALTHCARE",        // 체성분, 혈압, 건강키오스크
  EDUCATION = "EDUCATION",          // 시니어 교육, 체험학습
  PUBLIC = "PUBLIC",                // 민원, 행정서비스
  RETAIL = "RETAIL",                // 무인 매장, 편의점
  ENTERTAINMENT = "ENTERTAINMENT",  // 영화관, 테마파크
  CUSTOM = "CUSTOM"                 // 사용자 정의
}
5. 접근성 메타데이터 섹션 (accessibility)
5.1 필드 명세
필드명
타입
필수
설명
validated
boolean
✅
접근성 검증 통과 여부
wcagLevel
enum
✅
준수 수준 (A, AA, AAA)
validationRules
object
✅
적용된 검증 규칙 목록
validationReport
array
✅
검증 결과 상세 리포트

5.2 검증 규칙 정의
interface ValidationRules {
  minTouchTarget: number;           // 최소 터치 타겟 (px), 기본 64
  minContrastRatio: number;         // 최소 색상 대비율, 기본 4.5
  requireTtsLabel: boolean;         // TTS 라벨 필수 여부
  requireHomeButton: boolean;       // 홈 버튼 필수 여부
  maxFontSize: number;              // 최대 폰트 크기 제한
  minFontSize: number;              // 최소 폰트 크기 (가독성)
  requireTimeoutReset: boolean;     // 세션 타임아웃 리셋 필수
  supportedLanguages: array;        // 지원 언어 목록
}

5.3 검증 리포트 구조
{
  "validationReport": [
    {
      "rule": "MIN_TOUCH_TARGET",
      "componentId": "comp_btn_01",
      "severity": "ERROR",
      "message": "버튼 크기가 64x64px 미만입니다 (현재: 48x48)",
      "suggestedFix": "크기를 64x64 이상으로 조정하세요"
    },
    {
      "rule": "CONTRAST_RATIO",
      "componentId": "comp_text_02",
      "severity": "WARNING",
      "message": "색상 대비율이 4.5:1 미만입니다 (현재: 3.8:1)",
      "suggestedFix": "텍스트 색상을 더 어둡게 조정하세요"
    }
  ]
}

6. 배포 메타데이터 섹션 (deployment)
6.1 필드 명세
필드명
타입
필수
설명
status
enum
✅
DRAFT, PUBLISHED, ARCHIVED, ROLLBACK
version
string
✅
Semver 형식 (예: "1.2.3")
targetDevices
array[enum]
✅
타겟 디바이스 크기
publishedAt
datetime
❌
게시 시각
publishedBy
string
❌
게시자 userId
approvalStatus
enum
❌
PENDING, APPROVED, REJECTED
rollbackVersion
string
❌
롤백 대상 이전 버전


6.2 targetDevices enum
enum DeviceSize {
  SMALL_15 = "15inch",    // 1366x768 또는 1920x1080
  MEDIUM_24 = "24inch",   // 1920x1080
  LARGE_32 = "32inch",    // 2560x1440 또는 3840x2160
  XLARGE_55 = "55inch",   // 3840x2160
  TABLET_10 = "10inch",   // 태블릿 (PWA/TWA)
  MOBILE = "mobile"       // 모바일 (PWA/TWA)
}

7. 글로벌 상태 섹션 (globalState)
7.1 필드 명세
interface GlobalState {
  initialValues: {
    [key: string]: any;  // 예: cart: [], currentUser: null
  };
  sessionConfig: {
    timeoutSeconds: number;          // 세션 타임아웃 (기본 60초)
    idleResetEnabled: boolean;       // 유휴 상태 초기화 여부
    resetTargetPageId: string;       // 리셋 시 이동할 페이지
    resetMessage: string;            // 리셋 시 표시 메시지
  };
  persistenceConfig: {
    enabled: boolean;                // 로컬 저장 여부
    snapshotIntervalSeconds: number; // 스냅샷 저장 주기 (기본 3초)
    maxSnapshots: number;            // 최대 스냅샷 개수
    restoreOnCrash: boolean;         // 크래시 시 복구 여부
  };
}
7.2 예시
{
  "globalState": {
    "initialValues": {
      "cart": [],
      "currentUser": null,
      "selectedCategory": "all",
      "language": "ko-KR"
    },
    "sessionConfig": {
      "timeoutSeconds": 60,
      "idleResetEnabled": true,
      "resetTargetPageId": "page_home",
      "resetMessage": "长时间没有操作，将返回首页"
    },
    "persistenceConfig": {
      "enabled": true,
      "snapshotIntervalSeconds": 3,
      "maxSnapshots": 5,
      "restoreOnCrash": true
    }
  }
}

8. 데이터셋 레지스트리 섹션 (datasets) ⭐ 핵심
8.1 DatasetDefinition 구조
interface DatasetDefinition {
  id: string;                          // 데이터셋 고유 ID
  name: string;                        // 표시 이름
  description: string;                 // 설명
  sourceType: DataSourceType;          // 데이터 소스 타입
  visualQuery?: VisualQueryDefinition; // 시각적 SQL (sourceType=VISUAL_SQL)
  rawQuery?: string;                   // Raw SQL (sourceType=RAW_SQL, 제한적)
  apiConfig?: ApiConfig;               // 외부 API (sourceType=API)
  staticData?: any[];                  // 정적 데이터 (sourceType=STATIC)
  schema: DataFieldSchema[];           // 데이터 필드 스키마
  cacheConfig: CacheConfig;            // 캐싱 설정
  permissions: DatasetPermissions;     // 접근 권한
}

8.2 DataSourceType enum
enum DataSourceType {
  VISUAL_SQL = "VISUAL_SQL",    // 시각적 SQL 빌더 (권장)
  RAW_SQL = "RAW_SQL",          // Raw SQL (슈퍼관리자만)
  API = "API",                  // 외부 REST/GraphQL API
  STATIC = "STATIC",            // 정적 JSON 데이터
  WEBSOCKET = "WEBSOCKET",      // 실시간 WebSocket 스트림
  MQTT = "MQTT",                // MQTT IoT 데이터
  PLUGIN = "PLUGIN"             // 커스텀 플러그인
}

8.3 VisualQueryDefinition (시각적 SQL) ⭐⭐⭐
interface VisualQueryDefinition {
  fromTable: string;                    // 기본 테이블
  fromAlias?: string;                   // 테이블 별칭
  joins: JoinClause[];                  // 조인 목록
  filters: FilterClause[];              // WHERE 조건
  groupBy?: string[];                   // GROUP BY 필드
  having?: FilterClause[];              // HAVING 조건
  orderBy?: OrderByClause[];            // ORDER BY
  limit?: number;                       // LIMIT
  offset?: number;                      // OFFSET
  selectFields: SelectFieldClause[];    // SELECT 필드
}

interface JoinClause {
  table: string;                        // 조인 대상 테이블
  alias?: string;                       // 테이블 별칭
  type: "INNER" | "LEFT" | "RIGHT" | "FULL";
  on: string;                           // 조인 조건 (예: "products.category_id = categories.id")
}

interface FilterClause {
  field: string;                        // 필드명 (예: "products.is_active")
  operator: FilterOperator;             // 연산자
  value: any;                           // 비교 값
  logic?: "AND" | "OR";                 // 다중 필터 시 논리 연산
  isParameter?: boolean;                // 파라미터 바인딩 여부
}

enum FilterOperator {
  EQ = "=",
  NE = "!=",
  GT = ">",
  GTE = ">=",
  LT = "<",
  LTE = "<=",
  IN = "IN",
  NOT_IN = "NOT IN",
  LIKE = "LIKE",
  NOT_LIKE = "NOT LIKE",
  BETWEEN = "BETWEEN",
  IS_NULL = "IS NULL",
  IS_NOT_NULL = "IS NOT NULL"
}

interface SelectFieldClause {
  field: string;                        // 원본 필드명
  alias?: string;                       // 결과 필드 별칭
  aggregate?: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
  distinct?: boolean;                   // DISTINCT 여부
}

8.4 시각적 SQL 예시 (카페 메뉴 조회)
{
  "id": "ds_menu_001",
  "name": "카페 메뉴 실시간 조회",
  "sourceType": "VISUAL_SQL",
  "visualQuery": {
    "fromTable": "products",
    "fromAlias": "p",
    "joins": [
      {
        "table": "categories",
        "alias": "c",
        "type": "INNER",
        "on": "p.category_id = c.id"
      },
      {
        "table": "inventory",
        "alias": "i",
        "type": "LEFT",
        "on": "p.id = i.product_id"
      }
    ],
    "filters": [
      {
        "field": "p.is_active",
        "operator": "=",
        "value": true,
        "logic": "AND"
      },
      {
        "field": "c.tenant_id",
        "operator": "=",
        "value": "{{CURRENT_TENANT_ID}}",
        "isParameter": true,
        "logic": "AND"
      },
      {
        "field": "i.stock_quantity",
        "operator": "GT",
        "value": 0,
        "logic": "AND"
      }
    ],
    "orderBy": [
      { "field": "p.display_order", "direction": "ASC" },
      { "field": "p.name", "direction": "ASC" }
    ],
    "limit": 100,
    "selectFields": [
      { "field": "p.id", "alias": "id" },
      { "field": "p.name", "alias": "name" },
      { "field": "p.price", "alias": "price" },
      { "field": "p.image_url", "alias": "image_url" },
      { "field": "c.name", "alias": "category_name" },
      { "field": "i.stock_quantity", "alias": "stock" }
    ]
  },
  "schema": [
    { "key": "id", "type": "string", "label": "상품ID" },
    { "key": "name", "type": "string", "label": "상품명" },
    { "key": "price", "type": "number", "label": "가격" },
    { "key": "image_url", "type": "string", "label": "이미지URL" },
    { "key": "category_name", "type": "string", "label": "카테고리" },
    { "key": "stock", "type": "number", "label": "재고" }
  ],
  "cacheConfig": {
    "enabled": true,
    "ttlSeconds": 300,
    "refreshStrategy": "ON_DEMAND"
  }
}

8.5 DataFieldSchema
interface DataFieldSchema {
  key: string;                          // 필드 키
  type: "string" | "number" | "boolean" | "datetime" | "json" | "array";
  label: string;                        // 표시 이름
  nullable?: boolean;                   // NULL 허용 여부
  format?: string;                      // 포맷 (예: "currency", "date", "url")
  validation?: FieldValidation;         // 클라이언트 측 검증 규칙
}

interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;                     // 정규식
  enum?: any[];                         // 허용 값 목록
}

8.6 CacheConfig
interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;                   // 캐시 유효시간
  refreshStrategy: "ON_DEMAND" | "PERIODIC" | "PUSH";
  refreshIntervalSeconds?: number;      // PERIODIC 전략 시 주기
  maxSize?: number;                     // 최대 캐시 항목 수
}

8.7 DatasetPermissions
interface DatasetPermissions {
  readRoles: string[];                  // 조회 가능 역할
  writeRoles: string[];                 // 수정 가능 역할
  rowLevelSecurity?: string;            // RLS 정책 이름
}

9. 페이지 및 컴포넌트 섹션 (pages)
9.1 PageDefinition 구조
interface PageDefinition {
  id: string;                           // 페이지 고유 ID
  name: string;                         // 페이지 이름
  description?: string;                 // 설명
  layout: LayoutDefinition;             // 레이아웃 설정
  components: ComponentInstance[];      // 페이지 내 컴포넌트 목록
  pageEnterAction?: string;             // 페이지 진입 시 실행 액션 체인 ID
  pageExitAction?: string;              // 페이지 이탈 시 실행 액션 체인 ID
  metadata?: PageMetadata;              // 페이지 메타데이터
}

interface LayoutDefinition {
  type: "FREEFORM" | "GRID" | "FLEX" | "RESPONSIVE";
  columns?: number;                     // GRID 타입 시 컬럼 수
  gap?: string;                         // 컴포넌트 간격 (예: "16px")
  padding?: string;                     // 페이지 패딩
  background?: BackgroundDefinition;    // 배경 설정
}

interface BackgroundDefinition {
  type: "COLOR" | "IMAGE" | "VIDEO" | "GRADIENT";
  value: string;                        // 색상 코드, 이미지 URL 등
  overlay?: string;                     // 오버레이 색상 (투명도 포함)
}

9.2 ComponentInstance 구조 ⭐⭐
interface ComponentInstance {
  id: string;                           // 컴포넌트 고유 ID
  type: string;                         // 컴포넌트 타입 (예: "ProductGrid", "LargeButton")
  position: PositionDefinition;         // 위치
  size: SizeDefinition;                 // 크기
  props: ComponentProps;                // 컴포넌트 속성
  datasetBinding?: DatasetBinding;      // 데이터셋 바인딩
  actionChainId?: string;               // 연결된 액션 체인 ID
  visibility?: VisibilityRule;          // 표시 조건
  accessibility: AccessibilityProps;    // 접근성 속성
  children?: ComponentInstance[];       // 자식 컴포넌트 (컨테이너 타입)
}

interface PositionDefinition {
  x: string;                            // X 좌표 (%, px, vw)
  y: string;                            // Y 좌표 (%, px, vh)
  z?: number;                           // Z-index
}

interface SizeDefinition {
  width: string;                        // 너비 (%, px, vw, auto)
  height: string;                       // 높이 (%, px, vh, auto)
  minWidth?: string;                    // 최소 너비
  minHeight?: string;                   // 최소 높이
  maxWidth?: string;                    // 최대 너비
  maxHeight?: string;                   // 최대 높이
}

9.3 DatasetBinding (데이터셋 바인딩)
interface DatasetBinding {
  datasetId: string;                    // 바인딩할 데이터셋 ID
  fieldMapping: {
    [componentField: string]: string;   // 컴포넌트 필드 → 데이터셋 필드
  };
  transformRules?: {
    [componentField: string]: TransformRule;
  };
  filterContext?: {
    [parameterName: string]: any;       // 데이터셋 필터 파라미터
  };
  pagination?: {
    enabled: boolean;
    pageSize: number;
    currentPageStateKey: string;        // 전역 상태에서 현재 페이지 키
  };
  refreshTrigger?: string;              // 데이터 새로고침 트리거 이벤트
}

interface TransformRule {
  type: "FORMAT" | "CALCULATE" | "MAP" | "CUSTOM";
  config: any;                          // 변환 설정
}

9.4 컴포넌트 타입별 Props 예시
LargeButton (공통 컴포넌트)
{
  "id": "comp_btn_01",
  "type": "LargeButton",
  "position": { "x": "10%", "y": "20%" },
  "size": { "width": "200px", "height": "80px" },
  "props": {
    "label": "주문하기",
    "icon": "shopping-cart",
    "backgroundColor": "#1A365D",
    "textColor": "#FFFFFF",
    "fontSize": 28,
    "borderRadius": 16,
    "hoverEffect": "scale",
    "clickSound": "click_confirm"
  },
  "accessibility": {
    "ttsLabel": "주문하기 버튼을 눌러주세요",
    "ariaLabel": "주문하기",
    "focusable": true
  },
  "actionChainId": "chain_start_order"
}

ProductGrid (카페 특화 컴포넌트)
{
  "id": "comp_grid_01",
  "type": "ProductGrid",
  "position": { "x": "5%", "y": "15%" },
  "size": { "width": "60%", "height": "70%" },
  "props": {
    "columns": 3,
    "cardWidth": "30%",
    "cardHeight": "auto",
    "showImage": true,
    "showPrice": true,
    "showStock": true,
    "outOfStockOverlay": true,
    "itemSpacing": "16px"
  },
  "datasetBinding": {
    "datasetId": "ds_menu_001",
    "fieldMapping": {
      "title": "name",
      "price": "price",
      "image": "image_url",
      "stock": "stock",
      "category": "category_name"
    },
    "transformRules": {
      "price": {
        "type": "FORMAT",
        "config": { "format": "currency", "locale": "ko-KR" }
      }
    },
    "filterContext": {
      "category": "{{globalState.selectedCategory}}"
    }
  },
  "actionChainId": "chain_add_to_cart"
}

ProductGrid (카페 특화 컴포넌트)
{
  "id": "comp_grid_01",
  "type": "ProductGrid",
  "position": { "x": "5%", "y": "15%" },
  "size": { "width": "60%", "height": "70%" },
  "props": {
    "columns": 3,
    "cardWidth": "30%",
    "cardHeight": "auto",
    "showImage": true,
    "showPrice": true,
    "showStock": true,
    "outOfStockOverlay": true,
    "itemSpacing": "16px"
  },
  "datasetBinding": {
    "datasetId": "ds_menu_001",
    "fieldMapping": {
      "title": "name",
      "price": "price",
      "image": "image_url",
      "stock": "stock",
      "category": "category_name"
    },
    "transformRules": {
      "price": {
        "type": "FORMAT",
        "config": { "format": "currency", "locale": "ko-KR" }
      }
    },
    "filterContext": {
      "category": "{{globalState.selectedCategory}}"
    }
  },
  "actionChainId": "chain_add_to_cart"
}

SeatMatrix (교통 특화 컴포넌트)
{
  "id": "comp_seat_01",
  "type": "SeatMatrix",
  "position": { "x": "10%", "y": "20%" },
  "size": { "width": "80%", "height": "60%" },
  "props": {
    "rows": 10,
    "cols": 4,
    "seatSize": 60,
    "showLegend": true,
    "legendPosition": "bottom",
    "seatStates": {
      "available": { "color": "#4CAF50", "label": "선택가능" },
      "occupied": { "color": "#F44336", "label": "매진" },
      "selected": { "color": "#2196F3", "label": "선택됨" },
      "disabled": { "color": "#9E9E9E", "label": "사용불가" }
    }
  },
  "datasetBinding": {
    "datasetId": "ds_seats_001",
    "fieldMapping": {
      "seatNumber": "seat_no",
      "status": "status",
      "price": "price"
    }
  },
  "actionChainId": "chain_select_seat"
}

10. 위젯 및 차트 섹션 (widgets) ⭐ 대시보드용
10.1 WidgetDefinition 구조
interface WidgetDefinition {
  id: string;                           // 위젯 고유 ID
  type: WidgetType;                     // 위젯 타입
  title: string;                        // 위젯 제목
  position: PositionDefinition;
  size: SizeDefinition;
  datasetBinding: DatasetBinding;       // 데이터 연동
  chartConfig?: ChartConfig;            // 차트 설정
  refreshInterval?: number;             // 자동 새로고침 주기 (초)
  displayMode: "KIOSK" | "ADMIN";       // 표시 모드 (키오스크용/관리자용)
}

enum WidgetType {
  // 차트 위젯
  BAR_CHART = "BAR_CHART",
  LINE_CHART = "LINE_CHART",
  PIE_CHART = "PIE_CHART",
  DONUT_CHART = "DONUT_CHART",
  AREA_CHART = "AREA_CHART",
  SCATTER_CHART = "SCATTER_CHART",
  
  // 통계 위젯
  KPI_CARD = "KPI_CARD",                // 핵심 지표 카드
  GAUGE = "GAUGE",                      // 게이지
  PROGRESS_BAR = "PROGRESS_BAR",
  
  // 테이블 위젯
  DATA_TABLE = "DATA_TABLE",
  RANKING_LIST = "RANKING_LIST",
  
  // 실시간 위젯
  LIVE_COUNTER = "LIVE_COUNTER",
  REALTIME_MAP = "REALTIME_MAP",
  
  // 커스텀 위젯
  CUSTOM = "CUSTOM"
}


10.2 ChartConfig
interface ChartConfig {
  // 공통 설정
  title?: string;
  subtitle?: string;
  showLegend: boolean;
  legendPosition: "top" | "bottom" | "left" | "right";
  showTooltip: boolean;
  animation: boolean;
  
  // 축 설정
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  
  // 색상 설정
  colorPalette: string[];               // 색상 팔레트
  backgroundColor?: string;
  
  // 데이터 매핑
  dataMapping: {
    category: string;                   // 카테고리 필드
    value: string;                      // 값 필드
    series?: string;                    // 시리즈 필드 (다중 계열)
  };
  
  // 타입별 추가 설정
  barChart?: { horizontal: boolean; stacked: boolean; };
  lineChart?: { showPoints: boolean; smooth: boolean; };
  pieChart?: { showPercentage: boolean; innerRadius?: number; };
}

interface AxisConfig {
  label: string;
  type: "category" | "linear" | "logarithmic" | "datetime";
  format?: string;                      // 숫자/날짜 포맷
  min?: number;
  max?: number;
  showGrid: boolean;
}

10.3 위젯 예시 (관리자 대시보드)
{
  "id": "widget_satisfaction_01",
  "type": "DONUT_CHART",
  "title": "설문 만족도 분포",
  "position": { "x": "5%", "y": "10%" },
  "size": { "width": "45%", "height": "40%" },
  "datasetBinding": {
    "datasetId": "ds_survey_stats_001",
    "fieldMapping": {
      "category": "rating",
      "value": "count"
    }
  },
  "chartConfig": {
    "showLegend": true,
    "legendPosition": "right",
    "showTooltip": true,
    "animation": true,
    "colorPalette": ["#F44336", "#FF9800", "#FFC107", "#8BC34A", "#4CAF50"],
    "dataMapping": {
      "category": "rating",
      "value": "count"
    },
    "pieChart": {
      "showPercentage": true,
      "innerRadius": 60
    }
  },
  "refreshInterval": 60,
  "displayMode": "ADMIN"
}

11. 액션 체인 섹션 (actionChains) ⭐⭐⭐ 비즈니스 로직
11.1 ActionChainDefinition 구조
interface ActionChainDefinition {
  id: string;                           // 체인 고유 ID
  name: string;                         // 체인 이름
  description?: string;                 // 설명
  nodes: ActionNode[];                  // 액션 노드 목록 (순차 실행)
  onError?: ErrorPolicy;                // 전역 에러 정책
  metadata?: {
    triggerType: "CLICK" | "PAGE_ENTER" | "PAGE_EXIT" | "TIMER" | "HARDWARE_EVENT";
    triggerComponentId?: string;        // 트리거 컴포넌트 ID
  };
}

interface ActionNode {
  id: string;                           // 노드 고유 ID
  type: ActionType;                     // 액션 타입
  config: any;                          // 액션 설정 (타입별 다름)
  condition?: ConditionExpression;      // 실행 조건 (선택)
  onError?: ErrorPolicy;                // 노드별 에러 정책
  nextNodeId?: string;                  // 조건부 분기 시 다음 노드
  parallel?: boolean;                   // 병렬 실행 여부
}

enum ActionType {
  // 상태 관리
  UPDATE_STATE = "UPDATE_STATE",
  RESET_STATE = "RESET_STATE",
  
  // 네비게이션
  NAVIGATE = "NAVIGATE",
  OPEN_MODAL = "OPEN_MODAL",
  CLOSE_MODAL = "CLOSE_MODAL",
  SHOW_TOAST = "SHOW_TOAST",
  SHOW_ALERT = "SHOW_ALERT",
  
  // 데이터 조작
  FETCH_DATASET = "FETCH_DATASET",
  SUBMIT_DATA = "SUBMIT_DATA",
  
  // 하드웨어 제어
  EXECUTE_DRIVER = "EXECUTE_DRIVER",
  WAIT_HARDWARE = "WAIT_HARDWARE",
  
  // 미디어
  PLAY_SOUND = "PLAY_SOUND",
  PLAY_VIDEO = "PLAY_VIDEO",
  SPEAK_TTS = "SPEAK_TTS",
  
  // 서버 통신
  CALL_API = "CALL_API",
  WEBSOCKET_SEND = "WEBSOCKET_SEND",
  
  // 제어 흐름
  CONDITIONAL = "CONDITIONAL",          // if-else
  LOOP = "LOOP",                        // 반복
  DELAY = "DELAY",                      // 지연
  PARALLEL = "PARALLEL",                // 병렬 실행
  
  // 사용자 정의
  CUSTOM_SCRIPT = "CUSTOM_SCRIPT"       // 커스텀 스크립트 (제한적)
}

11.2 ActionType별 Config 상세
UPDATE_STATE
{
  stateKey: string;                     // 전역 상태 키 (예: "cart.items")
  operation: "SET" | "PUSH" | "POP" | "UPDATE" | "DELETE" | "INCREMENT" | "DECREMENT";
  value: any;                           // 설정할 값
  path?: string;                        // 중첩 객체 접근 경로 (예: "cart.items[0].quantity")
}

NAVIGATE
{
  targetPageId: string;                 // 이동할 페이지 ID
  transition: "FADE" | "SLIDE" | "NONE";
  preserveState: boolean;               // 상태 유지 여부
  params?: {                            // 페이지 파라미터
    [key: string]: any;
  };
}

EXECUTE_DRIVER (하드웨어)
{
  driverId: string;                     // 하드웨어 드라이버 ID
  command: string;                      // 실행 명령 (예: "PRINT_RECEIPT")
  payload: any;                         // 명령 파라미터
  timeoutMs: number;                    // 타임아웃
  retryOnFailure: boolean;
  maxRetries: number;
}
WAIT_HARDWARE
{
  hardwareType: "BARCODE_SCANNER" | "CARD_READER" | "PHYSICAL_BUTTON" | "NFC" | "RFID";
  timeoutMs: number;
  showWaitingUI: boolean;               // 대기 중 UI 표시
  waitingMessage: string;
  onSuccessStateKey: string;            // 성공 시 결과 저장할 상태 키
}
CALL_API
{
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;                     // API 엔드포인트
  headers?: { [key: string]: string };
  body?: any;
  queryParams?: { [key: string]: any };
  timeoutMs: number;
  responseStateKey: string;             // 응답 저장할 상태 키
  errorStateKey?: string;               // 에러 저장할 상태 키
}

CONDITIONAL (조건부 분기)
{
  condition: ConditionExpression;
  thenNodeId: string;                   // 참일 때 실행할 노드
  elseNodeId?: string;                  // 거짓일 때 실행할 노드
}

interface ConditionExpression {
  left: string;                         // 왼쪽 피연산자 (상태 키 또는 값)
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "IN" | "NOT_IN" | "CONTAINS";
  right: any;                           // 오른쪽 피연산자
  logic?: "AND" | "OR";                 // 다중 조건 시
}

11.3 액션 체인 예시 (커피 주문 → 결제 → 영수증)
{
  "id": "chain_checkout",
  "name": "결제 및 영수증 출력",
  "nodes": [
    {
      "id": "node_1",
      "type": "CONDITIONAL",
      "config": {
        "condition": {
          "left": "{{globalState.cart.length}}",
          "operator": ">",
          "right": 0
        },
        "thenNodeId": "node_2",
        "elseNodeId": "node_error"
      }
    },
    {
      "id": "node_2",
      "type": "SHOW_TOAST",
      "config": {
        "message": "결제를 진행합니다...",
        "duration": 2000
      }
    },
    {
      "id": "node_3",
      "type": "WAIT_HARDWARE",
      "config": {
        "hardwareType": "CARD_READER",
        "timeoutMs": 30000,
        "showWaitingUI": true,
        "waitingMessage": "카드를 넣어주세요",
        "onSuccessStateKey": "paymentResult"
      },
      "onError": {
        "policy": "SHOW_MODAL",
        "config": {
          "modalId": "modal_payment_timeout",
          "message": "카드 인식 시간 초과"
        }
      }
    },
    {
      "id": "node_4",
      "type": "CALL_API",
      "config": {
        "method": "POST",
        "endpoint": "/api/v1/orders",
        "body": {
          "items": "{{globalState.cart}}",
          "totalAmount": "{{globalState.totalAmount}}",
          "paymentResult": "{{globalState.paymentResult}}"
        },
        "responseStateKey": "orderResult",
        "timeoutMs": 10000
      }
    },
    {
      "id": "node_5",
      "type": "EXECUTE_DRIVER",
      "config": {
        "driverId": "{{hardwareBindings.receiptPrinter}}",
        "command": "PRINT_RECEIPT",
        "payload": {
          "orderId": "{{globalState.orderResult.orderId}}",
          "items": "{{globalState.cart}}",
          "totalAmount": "{{globalState.totalAmount}}"
        },
        "timeoutMs": 5000
      }
    },
    {
      "id": "node_6",
      "type": "SPEAK_TTS",
      "config": {
        "text": "결제가 완료되었습니다. 감사합니다.",
        "voiceType": "senior_female"
      }
    },
    {
      "id": "node_7",
      "type": "RESET_STATE",
      "config": {
        "keys": ["cart", "paymentResult", "orderResult"]
      }
    },
    {
      "id": "node_8",
      "type": "NAVIGATE",
      "config": {
        "targetPageId": "page_complete",
        "transition": "FADE"
      }
    }
  ],
  "onError": {
    "policy": "SHOW_MODAL",
    "config": {
      "modalId": "modal_error_default",
      "message": "오류가 발생했습니다. 다시 시도해주세요."
    }
  }
}

12. 하드웨어 바인딩 섹션 (hardwareBindings)
12.1 HardwareBindingDefinition
interface HardwareBindingDefinition {
  id: string;                           // 바인딩 고유 ID
  name: string;                         // 표시 이름
  driverId: string;                     // 연결할 드라이버 ID (서버 레지스트리에서)
  hardwareType: HardwareType;           // 하드웨어 타입
  config: HardwareConfig;               // 하드웨어별 설정
  fallbackDriverId?: string;            // 실패 시 폴백 드라이버
  priority: number;                     // 우선순위
}

enum HardwareType {
  RECEIPT_PRINTER = "RECEIPT_PRINTER",
  CARD_READER = "CARD_READER",
  BARCODE_SCANNER = "BARCODE_SCANNER",
  NFC_READER = "NFC_READER",
  COIN_ACCEPTOR = "COIN_ACCEPTOR",
  BILL_ACCEPTOR = "BILL_ACCEPTOR",
  CAMERA = "CAMERA",
  SPEAKER = "SPEAKER",
  PHYSICAL_BUTTONS = "PHYSICAL_BUTTONS",
  SENSOR = "SENSOR"
}

interface HardwareConfig {
  connectionType: "SERIAL" | "USB" | "NETWORK" | "BLUETOOTH" | "SIMULATION";
  port?: string;                        // 시리얼 포트 (예: "/dev/ttyUSB0")
  baudRate?: number;                    // 보드 레이트
  ipAddress?: string;                   // 네트워크 주소
  timeoutMs?: number;                   // 타임아웃
  retryCount?: number;                  // 재시도 횟수
}

12.3 하드웨어 바인딩 예시
{
  "hardwareBindings": {
    "receiptPrinter": {
      "id": "hw_printer_01",
      "name": "영수증 프린터",
      "driverId": "bixolon_srp350_real",
      "hardwareType": "RECEIPT_PRINTER",
      "config": {
        "connectionType": "SERIAL",
        "port": "/dev/ttyUSB0",
        "baudRate": 9600,
        "timeoutMs": 5000,
        "retryCount": 3
      },
      "fallbackDriverId": "mock_printer_simulation",
      "priority": 1
    },
    "cardReader": {
      "id": "hw_card_01",
      "name": "카드 리더",
      "driverId": "posbank_card_reader",
      "hardwareType": "CARD_READER",
      "config": {
        "connectionType": "USB",
        "timeoutMs": 30000
      },
      "fallbackDriverId": "mock_card_reader_simulation",
      "priority": 1
    }
  }
}

13. 완전한 템플릿 예시 (시니어 카페 주문 키오스크)
{
  "schemaVersion": "2.1.0",
  "engineCompatibility": "^2.0.0",
  "metadata": {
    "templateId": "tpl_cafe_senior_001",
    "tenantId": "tenant_seoul_center_a",
    "name": "시니어 카페 주문 키오스크",
    "description": "아메리카노, 라떼 등 시니어 친화적 메뉴 주문",
    "industry": "CAFE",
    "tags": ["시니어", "카페", "주문", "교육용"],
    "thumbnailUrl": "https://cdn.kiosk.com/thumbs/cafe_senior.jpg",
    "author": {
      "userId": "user_admin_001",
      "name": "김관리"
    },
    "createdAt": "2026-09-22T10:30:00Z",
    "updatedAt": "2026-09-22T14:45:00Z"
  },
  "accessibility": {
    "validated": true,
    "wcagLevel": "AAA",
    "validationRules": {
      "minTouchTarget": 64,
      "minContrastRatio": 7.0,
      "requireTtsLabel": true,
      "requireHomeButton": true,
      "minFontSize": 24,
      "requireTimeoutReset": true
    },
    "validationReport": []
  },
  "deployment": {
    "status": "PUBLISHED",
    "version": "1.2.0",
    "targetDevices": ["15inch", "24inch", "32inch"],
    "publishedAt": "2026-09-22T15:00:00Z",
    "publishedBy": "user_admin_001",
    "approvalStatus": "APPROVED"
  },
  "globalState": {
    "initialValues": {
      "cart": [],
      "selectedCategory": "all",
      "totalAmount": 0,
      "language": "ko-KR"
    },
    "sessionConfig": {
      "timeoutSeconds": 60,
      "idleResetEnabled": true,
      "resetTargetPageId": "page_home",
      "resetMessage": "长时间没有操作，将返回首页"
    },
    "persistenceConfig": {
      "enabled": true,
      "snapshotIntervalSeconds": 3,
      "maxSnapshots": 5,
      "restoreOnCrash": true
    }
  },
  "datasets": [
    {
      "id": "ds_menu_001",
      "name": "카페 메뉴 실시간 조회",
      "sourceType": "VISUAL_SQL",
      "visualQuery": {
        "fromTable": "products",
        "fromAlias": "p",
        "joins": [
          {
            "table": "categories",
            "alias": "c",
            "type": "INNER",
            "on": "p.category_id = c.id"
          }
        ],
        "filters": [
          {
            "field": "p.is_active",
            "operator": "=",
            "value": true,
            "logic": "AND"
          },
          {
            "field": "c.tenant_id",
            "operator": "=",
            "value": "{{CURRENT_TENANT_ID}}",
            "isParameter": true,
            "logic": "AND"
          }
        ],
        "orderBy": [
          { "field": "p.display_order", "direction": "ASC" }
        ],
        "selectFields": [
          { "field": "p.id", "alias": "id" },
          { "field": "p.name", "alias": "name" },
          { "field": "p.price", "alias": "price" },
          { "field": "p.image_url", "alias": "image_url" },
          { "field": "c.name", "alias": "category_name" }
        ]
      },
      "schema": [
        { "key": "id", "type": "string", "label": "상품ID" },
        { "key": "name", "type": "string", "label": "상품명" },
        { "key": "price", "type": "number", "label": "가격" },
        { "key": "image_url", "type": "string", "label": "이미지URL" },
        { "key": "category_name", "type": "string", "label": "카테고리" }
      ],
      "cacheConfig": {
        "enabled": true,
        "ttlSeconds": 300,
        "refreshStrategy": "ON_DEMAND"
      }
    }
  ],
  "pages": [
    {
      "id": "page_home",
      "name": "홈 화면",
      "layout": {
        "type": "FREEFORM",
        "background": {
          "type": "COLOR",
          "value": "#F5F5F5"
        }
      },
      "components": [
        {
          "id": "comp_title_01",
          "type": "TTS_Text",
          "position": { "x": "10%", "y": "5%" },
          "size": { "width": "80%", "height": "10%" },
          "props": {
            "content": "안녕하세요! 주문을 시작해 주세요",
            "fontSize": 48,
            "textColor": "#1A365D",
            "textAlign": "center"
          },
          "accessibility": {
            "ttsLabel": "안녕하세요! 주문을 시작해 주세요",
            "autoRead": true
          }
        },
        {
          "id": "comp_btn_start_01",
          "type": "LargeButton",
          "position": { "x": "30%", "y": "40%" },
          "size": { "width": "40%", "height": "120px" },
          "props": {
            "label": "주문 시작하기",
            "icon": "shopping-cart",
            "backgroundColor": "#1A365D",
            "textColor": "#FFFFFF",
            "fontSize": 36,
            "borderRadius": 20
          },
          "accessibility": {
            "ttsLabel": "주문 시작하기 버튼을 눌러주세요"
          },
          "actionChainId": "chain_start_order"
        }
      ]
    },
    {
      "id": "page_menu",
      "name": "메뉴 선택",
      "layout": {
        "type": "FREEFORM",
        "background": {
          "type": "COLOR",
          "value": "#FFFFFF"
        }
      },
      "components": [
        {
          "id": "comp_grid_01",
          "type": "ProductGrid",
          "position": { "x": "5%", "y": "15%" },
          "size": { "width": "60%", "height": "70%" },
          "props": {
            "columns": 3,
            "showImage": true,
            "showPrice": true,
            "itemSpacing": "16px"
          },
          "datasetBinding": {
            "datasetId": "ds_menu_001",
            "fieldMapping": {
              "title": "name",
              "price": "price",
              "image": "image_url",
              "category": "category_name"
            },
            "transformRules": {
              "price": {
                "type": "FORMAT",
                "config": { "format": "currency", "locale": "ko-KR" }
              }
            }
          },
          "actionChainId": "chain_add_to_cart"
        },
        {
          "id": "comp_cart_01",
          "type": "CartSidebar",
          "position": { "x": "68%", "y": "15%" },
          "size": { "width": "28%", "height": "70%" },
          "props": {
            "showTotal": true,
            "showQuantityControl": true,
            "backgroundColor": "#F9F9F9"
          },
          "accessibility": {
            "ttsLabel": "장바구니"
          }
        },
        {
          "id": "comp_btn_checkout_01",
          "type": "LargeButton",
          "position": { "x": "68%", "y": "87%" },
          "size": { "width": "28%", "height": "80px" },
          "props": {
            "label": "결제하기",
            "backgroundColor": "#4CAF50",
            "textColor": "#FFFFFF",
            "fontSize": 32
          },
          "accessibility": {
            "ttsLabel": "결제하기 버튼을 눌러주세요"
          },
          "actionChainId": "chain_checkout"
        }
      ]
    }
  ],
  "actionChains": {
    "chain_start_order": {
      "id": "chain_start_order",
      "name": "주문 시작",
      "nodes": [
        {
          "id": "node_1",
          "type": "NAVIGATE",
          "config": {
            "targetPageId": "page_menu",
            "transition": "FADE"
          }
        }
      ]
    },
    "chain_add_to_cart": {
      "id": "chain_add_to_cart",
      "name": "장바구니에 추가",
      "nodes": [
        {
          "id": "node_1",
          "type": "UPDATE_STATE",
          "config": {
            "stateKey": "cart",
            "operation": "PUSH",
            "value": "{{SELECTED_ITEM}}"
          }
        },
        {
          "id": "node_2",
          "type": "UPDATE_STATE",
          "config": {
            "stateKey": "totalAmount",
            "operation": "INCREMENT",
            "value": "{{SELECTED_ITEM.price}}"
          }
        },
        {
          "id": "node_3",
          "type": "PLAY_SOUND",
          "config": {
            "soundId": "click_confirm"
          }
        }
      ]
    },
    "chain_checkout": {
      "id": "chain_checkout",
      "name": "결제 및 영수증 출력",
      "nodes": [
        {
          "id": "node_1",
          "type": "SHOW_TOAST",
          "config": {
            "message": "결제를 진행합니다...",
            "duration": 2000
          }
        },
        {
          "id": "node_2",
          "type": "WAIT_HARDWARE",
          "config": {
            "hardwareType": "CARD_READER",
            "timeoutMs": 30000,
            "showWaitingUI": true,
            "waitingMessage": "카드를 넣어주세요",
            "onSuccessStateKey": "paymentResult"
          }
        },
        {
          "id": "node_3",
          "type": "CALL_API",
          "config": {
            "method": "POST",
            "endpoint": "/api/v1/orders",
            "body": {
              "items": "{{globalState.cart}}",
              "totalAmount": "{{globalState.totalAmount}}",
              "paymentResult": "{{globalState.paymentResult}}"
            },
            "responseStateKey": "orderResult",
            "timeoutMs": 10000
          }
        },
        {
          "id": "node_4",
          "type": "EXECUTE_DRIVER",
          "config": {
            "driverId": "{{hardwareBindings.receiptPrinter}}",
            "command": "PRINT_RECEIPT",
            "payload": {
              "orderId": "{{globalState.orderResult.orderId}}",
              "items": "{{globalState.cart}}",
              "totalAmount": "{{globalState.totalAmount}}"
            },
            "timeoutMs": 5000
          }
        },
        {
          "id": "node_5",
          "type": "SPEAK_TTS",
          "config": {
            "text": "결제가 완료되었습니다. 감사합니다.",
            "voiceType": "senior_female"
          }
        },
        {
          "id": "node_6",
          "type": "RESET_STATE",
          "config": {
            "keys": ["cart", "paymentResult", "orderResult", "totalAmount"]
          }
        },
        {
          "id": "node_7",
          "type": "NAVIGATE",
          "config": {
            "targetPageId": "page_home",
            "transition": "FADE"
          }
        }
      ],
      "onError": {
        "policy": "SHOW_MODAL",
        "config": {
          "modalId": "modal_error_default",
          "message": "오류가 발생했습니다. 다시 시도해주세요."
        }
      }
    }
  },
  "hardwareBindings": {
    "receiptPrinter": {
      "id": "hw_printer_01",
      "name": "영수증 프린터",
      "driverId": "bixolon_srp350_real",
      "hardwareType": "RECEIPT_PRINTER",
      "config": {
        "connectionType": "SERIAL",
        "port": "/dev/ttyUSB0",
        "baudRate": 9600,
        "timeoutMs": 5000,
        "retryCount": 3
      },
      "fallbackDriverId": "mock_printer_simulation",
      "priority": 1
    },
    "cardReader": {
      "id": "hw_card_01",
      "name": "카드 리더",
      "driverId": "posbank_card_reader",
      "hardwareType": "CARD_READER",
      "config": {
        "connectionType": "USB",
        "timeoutMs": 30000
      },
      "fallbackDriverId": "mock_card_reader_simulation",
      "priority": 1
    }
  }
}

14. 확장 포인트 및 향후 로드맵
14.1 현재 스키마에서 확장 가능한 영역
customExtensions 섹션: 산업군별 커스텀 메타데이터 저장
PLUGIN 타입 데이터 소스: 새로운 데이터 소스 타입 추가
CUSTOM_SCRIPT 액션: 제한적 커스텀 로직 실행
CUSTOM 위젯 타입: 커스텀 차트/위젯 등록
14.2 향후 추가 예정 기능
AI 추천 엔진: 사용자 행동 기반 메뉴 추천
다국어 자동 번역: 템플릿 다국어 자동 생성
실시간 협업 편집: 여러 관리자가 동시에 템플릿 편집
A/B 테스트: 동일 페이지의 여러 버전 동시 배포
블록체인 감사 로그: 중요한 변경사항의 불변 기록
15. 총괄 PM의 최종 검증 체크리스트
이 명세서가 코드 구현 전 완벽하게 검증되었는지 확인하세요:
메타데이터: 모든 템플릿이 industry, tags, accessibility 메타데이터를 포함하는가?
시각적 SQL: Raw SQL 없이도 복잡한 조인과 필터를 표현 가능한가?
데이터 바인딩: 컴포넌트 필드와 데이터셋 필드의 매핑이 명확한가?
액션 체인: 조건부 분기, 에러 처리, 하드웨어 대기가 모두 표현 가능한가?
하드웨어 바인딩: 실제/시뮬레이션 드라이버 전환이 동적으로 가능한가?
접근성: 모든 상호작용 컴포넌트가 TTS 라벨을 포함하는가?
배포: 버전 관리, 타겟 디바이스, 게시 상태가 명확한가?
확장성: 새로운 산업군/컴포넌트 추가 시 스키마를 깨지 않는가?

