이 프로젝트가 단순히 "만들어지는 것"을 넘어 "현장에서 성공적으로 안착" 하도록 다음 4가지 규칙을 프로젝트 헌장(Project Charter)으로 선언합니다.
① 동적 하드웨어 관리 워크플로우 (Admin Workflow)
슈퍼 관리자는 관리자 대시보드 > 하드웨어 관리 메뉴에서 새 드라이버를 등록합니다.
예: 이름: "센터A 전용 Mock 프린터", 타입: SIMULATION, 설정: {"delay_ms": 1000, "mock_paper_jam_prob": 0.05} (교육용 오류 상황까지 시뮬레이션 가능).
서브 관리자(센터장) 는 템플릿 에디터에서 '영수증 출력' 컴포넌트를 드래그합니다.
우측 속성 패널의 드롭다운에서 방금 슈퍼 관리자가 등록한 "센터A 전용 Mock 프린터"를 선택하고 저장합니다.
키오스크 클라이언트는 배포된 JSON을 읽고, 해당 driver_id로 Tauri 백엔드에 명령을 보냅니다.
결과: 코드 재배포(Re-deploy) 없이 관리자의 설정 변경만으로 키오스크의 동작이 완전히 바뀝니다.
② 시니어 접근성 강제 검증 게이트 (Accessibility Gate)
템플릿이 "배포(Publish)" 버튼을 누르는 순간, 백엔드에서 자동 검증 스크립트가 실행됩니다.
❌ 버튼 간격이 48px 미만인가? → 배포 차단 및 경고.
❌ 배경과 텍스트의 대비율(Contrast Ratio)이 4.5:1 미만인가? → 배포 차단.
❌ '음성 안내(TTS)' 속성이 비어있는 인터랙티브 요소가 있는가? → 경고.
이를 통해 어떤 센터장이 템플릿을 엉망으로 만들어도 기본적인 시니어 사용성은 보장됩니다.
③ 하드웨어 페일세이프 (Fail-Safe) 및 큐잉
실제 키오스크 현장에서 프린터 케이블이 빠지는 일은 비일비재합니다.
Tauri 클라이언트는 execute_hardware_action 실패 시, 명령을 로컬 SQLite(또는 Tauri Store)에 pending 상태로 큐잉합니다.
키오스크 화면에는 "프린터 연결을 확인해주세요"라는 큰 고대비 안내 문구를 띄우고, 물리 버튼(또는 터치)으로 "다시 시도" 또는 "건너뛰기"를 선택하게 하여 교육 흐름이 중단되지 않도록 설계합니다.
④ 단계별 롤아웃 계획 (Phase Rollout)
Phase 1 (Week 1-2): Rust Axum 멀티테넌시 백엔드 + 동적 드라이버 레지스트리 API 완성.
Phase 2 (Week 3-4): React DnD 에디터 구현 및 JSON 스키마 직렬화/역직렬화 검증.
Phase 3 (Week 5-6): Tauri 2 클라이언트 구현 및 Mock/Simulation 드라이버 연동 테스트 (15/21/32인치 반응형 검증).
Phase 4 (Week 7-8): 시니어 접근성 자동 검증 로직 삽입 및 E2E 테스트 자동화(CI/CD).

📑 [마스터 설계 및 프롬프트 명세서] 시니어 교육용 멀티테넌트 키오스크 플랫폼
문서 목적: 본 문서는 개발자, 디자이너, AI 에이전트가 이 프로젝트의 전체 맥락을 100% 이해하고, 확장 가능하고 견고한 시스템을 구축하기 위한 최상위 지침서(Master Prompt)입니다.
[A] 배포 아키텍처: 하이브리드 (Public Cloud ↔ Closed-Cloud Local)
마스터님의 요구사항인 "로컬 폐쇄형 클라우드"와 "퍼블릭 클라우드"를 동일한 코드베이스로 지원하기 위한 설계입니다.
컨테이너 기반 경량화 배포 (Docker/K8s Ready)
백엔드(Rust Axum), 프론트엔드(React Admin), DB(PostgreSQL/SQLite)를 모두 컨테이너화합니다.
Public Cloud 모드: PostgreSQL(RDS), Redis, S3(에셋 저장소)를 사용하여 다중 테넌트 대규모 처리.
Closed-Cloud(로컬) 모드: 복지관/센터 내 로컬 서버(NUC 등)에서 docker-compose up 하나로 실행되도록 설계. DB는 경량화된 PostgreSQL 또는 SQLite로 자동 폴백(Fallback), 에셋은 로컬 파일 시스템 저장.
키오스크 동기화 에이전트 (Sync Agent)
키오스크 클라이언트(Tauri/TWA)는 주기적으로(또는 WebSocket으로) 서버와 통신합니다.
핵심 기능: 네트워크가 끊겨도 로컬 캐시된 최신 템플릿과 에셋으로 무정지 운영이 가능해야 합니다. 네트워크 복원 시 자동으로 변경된 템플릿과 로그를 동기화합니다.
[B] 하드웨어 해상도 적응 엔진 (Dynamic Resolution Engine)
15인치, 21/24인치, 32인치, 55인치 등 다양한 크기에 "하나의 템플릿"으로 대응하기 위한 설계입니다.
상대적 그리드 시스템 (Relative Grid System)
절대적 픽셀(px) 배치를 금지합니다. 모든 컴포넌트는 vw, vh, % 또는 CSS Grid의 fr 단위로 배치됩니다.
Breakpoint 정의:
Small (15~19인치): 단일 컬럼, 세로 스크롤 최소화, 버튼 크기 120% 확대.
Medium (21~24인치): 2컬럼 그리드, 표준 시니어 UI 적용.
Large (32~55인치): 3~4컬럼 그리드, 사이드바 내비게이션 활성화, 고해상도 에셋 자동 로드.
에셋 자동 최적화 (Adaptive Asset Delivery)
관리자가 4K 이미지를 업로드하면, 백엔드에서 자동으로 15인치용(720p), 24인치용(1080p)으로 리사이징하여 저장합니다. 키오스크는 자신의 해상도에 맞는 에셋만 다운로드하여 로컬 스토리지 부족을 방지합니다.
[C] 노코드 키오스크 페이지 빌더 (No-Code Kiosk Page Builder)
FlutterFlow처럼 쉽지만, "웹사이트"가 아닌 "키오스크 앱 플로우"에 특화된 드래그앤드롭 에디터 설계입니다.
페이지 플로우 상태 머신 (State Machine Flow)
단일 페이지 편집이 아닌, [시작 화면] → [메뉴 선택] → [상세 교육 콘텐츠] → [결제/출력 시뮬레이션] → [홈 복귀] 의 플로우를 시각적으로 연결하는 노드 에디터를 제공합니다.
타임아웃 자동 복귀: 시니어가 일정 시간(예: 30초) 동안 터치를 하지 않으면 자동으로 첫 화면으로 복귀하는 타이머 컴포넌트를 기본 탑재합니다.
시니어 특화 컴포넌트 팔레트 (Senior-First Component Palette)
LargeButton: 최소 터치 영역 64x64px 보장, 클릭 시 명확한 시각/청각 피드백 내장.
TTS_Text: 텍스트를 넣으면 키오스크에서 자동으로 읽어주는 음성 합성(TTS) 속성 포함.
HardwareTrigger: 버튼 클릭 시 연결된 드라이버(프린터, 카드 리더 시뮬레이션)를 실행하는 액션 블록.
MediaPlayer: 동영상 재생 시 자동 자막 및 수어(수화) 영상 오버레이 지원 영역.
접근성 자동 검증 게이트 (Accessibility Auto-Validator)
관리자가 [게시(Publish)] 버튼을 누르는 순간, 시스템이 자동으로 검사합니다.
❌ 배경-텍스트 대비율(Contrast Ratio) < 4.5:1 → 게시 차단 및 경고
❌ 버튼 간격 < 8px → 게시 차단 및 경고
❌ TTS 안내 텍스트 누락 → 경고 표시 (강제 차단 아님)
[D] 고급 멀티테넌시 및 RBAC (Role-Based Access Control)
수퍼 관리자부터 현장 운영자까지 권한과 기능 제한을 세밀하게 통제합니다.
계층적 권한 구조
SUPER_ADMIN: 전체 시스템 관리, 마스터 템플릿 생성, 새 하드웨어 드라이버 플러그인 등록, 모든 테넌트 모니터링.
TENANT_ADMIN (센터장): 자신의 센터(Sub-domain) 내 기기 관리, 마스터 템플릿을 복사하여 센터 맞춤형으로 수정(이미지/텍스트 변경), 센터 내 사용자(강사) 계정 생성.
GROUP_MANAGER (팀장/강사): 특정 키오스크 그룹(예: 1층 로비 3대)에 할당된 템플릿의 게시 여부 승인, 간단한 로그 확인.
DEVICE_OPERATOR (현장 관리): 기기 재시작, 용지 교체 알림 확인, 캐시 초기화 등 물리적 관리만 가능.
기능 플래그 (Feature Flags) 및 앱별 제한
테넌트 계약 등급에 따라 사용 가능한 컴포넌트를 제한합니다. (예: Basic 플랜은 HardwareTrigger 사용 불가, Premium 플랜은 전체 사용).
특정 템플릿은 특정 기기 그룹(예: 32인치 이상만)에만 게시하도록 제약 조건을 걸 수 있습니다.
[E] 총괄 PM이 보완한 핵심 놓친 부분 (Gap Filling)
마스터님께서 언급하지 않으셨지만, 실제 현장 운영에서 반드시 실패하지 않기 위해 추가한 설계입니다.
원격 진단 및 헬스체크 (Remote Health Monitoring)
키오스크는 1분마다 Heartbeat를 보냅니다. 여기에는 CPU 사용량, 로컬 저장소 잔량, 프린터 용지 부족 상태(시뮬레이션 또는 실제), 터치스크린 오작동 로그가 포함됩니다.
수퍼 관리자 대시보드에 "센터A 3번 기기: 저장소 90% 초과, 용지 부족"과 같은 선제적 경고가 뜹니다.
버전 관리 및 원클릭 롤백 (Versioning & Rollback)
템플릿을 수정하여 게시할 때마다 v1.0, v1.1로 버전이 기록됩니다.
현장 키오스크에서 새 템플릿 적용 후 오류가 발생하면, 관리자가 대시보드에서 [이전 버전으로 긴급 롤백] 버튼을 한 번 누르는 즉시 모든 기기가 이전 안정적인 버전으로 복구됩니다.
시니어 행동 분석 히트맵 (Kiosk Telemetry & Heatmap)
어떤 버튼을 가장 많이 누르는지, 어디에서 멈춰서 헤매는지(체류 시간)를 익명화된 로그로 수집합니다.
이를 통해 "이 교육용 앱의 '결제하기' 버튼이 너무 작아 시니어가 평균 3번 이상 잘못 누른다"는 인사이트를 제공하여 템플릿 개선에 활용합니다.
🛠️ 향후 확장성을 위한 설계 원칙 (Future-Proofing)
플러그인 아키텍처 (Plugin Architecture):
새로운 교육 앱(예: F-금융 교육)이나 새로운 하드웨어(지문 인식기 등)가 추가될 때, 핵심 코드를 수정하지 않고 driver_plugin 또는 component_plugin 폴더에 새로운 모듈을 넣기만 하면 관리자의 '드라이버 추가' 화면에 자동으로 등장하도록 설계합니다.
JSON 스키마의 하위 호환성:
템플릿 저장 포맷(JSON)은 버전("schema_version": "1.0")을 포함합니다. 향후 에디터가 업그레이드되어도 이전 버전 JSON을 읽어서 자동으로 최신 컴포넌트로 마이그레이션하는 로직을 백엔드에 내장합니다.

단순한 키오스크 템플릿 배포를 넘어, ① 앱 수행 능력(App Execution Telemetry) 추적, ② 시니어 맞춤형 설문(Survey) 수집, ③ 실시간 통계 및 차트 시각화(Analytics & Visualization) 가 추가됨으로써, 이 플랫폼은 단순한 '표출 도구'가 아니라 '데이터 기반 시니어 교육 성과 관리 솔루션' 으로 격상됩니다.
또한 마스터님께서 놓치기 쉬운 저사양 키오스크에서의 차트 렌더링 부하, 설문 데이터의 개인정보(PII) 보호, 오프라인 환경에서의 설문 응답 큐잉 등의 치명적 리스크를 제가 선제적으로 설계에 반영하였습니다.
요청하신 12가지 마스터 마크다운(Prompt/Spec) 파일의 완전한 구조와 상세 내용을 제시합니다. 이 문서들은 개발팀이나 AI 코딩 에이전트에게 그대로 투입하여 일관성 있고 오류 없는 코드를 생성하게 할 최상위 프롬프트 구조입니다.
📑 [마스터 프롬프트 구조 명세서] 시니어 교육용 키오스크 플랫폼 (v2.0)
사용 지침: 각 마크다운 블록은 독립적인 "마스터 프롬프트"로 작동합니다. 개발자는 이 내용을 읽고 해당 도메인의 아키텍처, 코드, 테스트를 일관된 규칙 하에 생성해야 합니다.

[메타 모델링(Meta-Modeling) 및 동적 데이터 바인딩 아키텍처] 를 도입했습니다. 이 설계는 향후 어떤 새로운 키오스크 앱이 나오더라도 코드를 수정하지 않고 데이터셋(Dataset)과 컴포넌트, 액션(Action)을 매핑하는 것만으로 완벽한 클론을 만들어낼 수 있습니다.
다음은 분석, 설계, 구현, 테스트의 전체 수명 주기(SDLC)를 아우르는 [완벽한 마스터 프롬프트 구조 및 아키텍처 명세서] 입니다.
🏗️ [마스터 아키텍처] 메타 모델링 기반 노코드 키오스크 플랫폼
1. 핵심 문제 해결: 동적 데이터 바인딩 엔진 (Dynamic Data Binding Engine)
기존의 에디터가 UI만 그렸다면, 새로운 에디터는 데이터(Data)와 상태(State) 를 다룹니다.
Data Source Registry (데이터 소스 레지스트리):
관리자가 UI에서 SQL 쿼리(SELECT * FROM coffee_menu)나 외부 API 엔드포인트를 '데이터셋'으로 등록합니다.
마스터님이 언급하신 커피, 도서관, 헬스케어 등의 데이터셋은 JSON 스키마 형태로 레지스트리에 저장됩니다.
Global State Store (전역 상태 스토어):
모든 키오스크 클라이언트는 내부에 가상의 '장바구니(Cart)', '로그인 세션(Session)', '예약 상태(Booking)'를 관리하는 스토어를 가집니다.
UI 컴포넌트는 이 스토어의 데이터를 실시간으로 구독(Subscribe)하고 반응합니다.
Action Chain Builder (액션 체인 빌더):
버튼 클릭 시 단순 페이지 이동이 아닌, 시각적 노드(Node)로 로직을 짭니다.
예시 (커피 주문): [버튼 클릭] → [전역 스토어에 아이템 추가] → [옵션 선택 모달 오픈] → [하드웨어(바코드 스캐너) 대기] → [결제 API 호출] → [프린터 드라이버 실행]
2. 도메인별 클론(Clone) 매핑 시나리오 분석
마스터님이 우려하신 다양한 키오스크 제품이 이 아키텍처에서 어떻게 구현되는지 분석합니다.
도메인 (키오스크 종류)
필수 컴포넌트 (Component)
데이터셋 (Dataset)
액션 체인 (Action Flow)
무인 카페 (커피 주문)
상품 그리드, 옵션 피커, 장바구니 사이드바, 결제 UI
메뉴 DB, 옵션 재고, 프로모션 정보
장바구니 담기 → 총액 계산 → 결제 시뮬레이션 → 영수증 출력
교통 (열차/고속버스)
시간표 리스트, 좌석 매트릭스(Seat Map), 달력 피커
실시간 시간표 API, 잔여 좌석 DB
시간 선택 → 좌석 클릭(상태 변경) → 승객 정보 입력 → 결제 및 발권
스마트 도서관
검색창, 도서 상세 카드, 바코드 리더기 영역
도서 메타데이터 DB, 회원 대출 이력
바코드 스캔(Hardware) → 도서 정보 Fetch → 대출/반납 처리
헬스케어 (체성분/혈압)
차트 시각화, 디바이스 연결 상태 표시, 이력 리스트
개인 건강 기록(PHR) DB, 측정 로그
측정 기기 연동(Bluetooth/Serial) → 데이터 수신 → 그래프 렌더링 → 출력
테이블 오더
테이블 번호 QR 인식, 메뉴 카테고리, 호출 버튼
매장 메뉴 DB, 테이블 상태 매트릭스
QR 스캔 → 테이블 바인딩 → 주문 전송 → 주방 프린터 라우팅
3. SDLC (분석-설계-구현-테스트) 통합 프롬프트 구조
AI 코딩 에이전트나 개발팀이 이 거대한 시스템을 구현할 때, 맥락을 놓치지 않도록 지시하는 프롬프트 체이닝(Prompt Chaining) 전략입니다.
[Phase 1: 분석 및 데이터 모델링]
프롬프트 지시: "다음은 커피 주문 키오스크의 비즈니스 로직이다. 이를 노코드 에디터에서 사용할 수 있도록 JSON 스키마 기반의 Dataset Definition과 Global State Interface로 추상화하여 설계하라."
산출물: 컴포넌트가 바인딩할 데이터 구조와 장바구니 상태 인터페이스 정의.
[Phase 2: 컴포넌트 및 에디터 설계]
프롬프트 지시: "설계된 데이터 구조를 기반으로, React DnD 에디터에서 사용될 DataGrid, SeatMap, CartSidebar 컴포넌트의 Props와 속성 패널(Property Panel) UI를 설계하라. 특히 데이터 소스(Data Source)를 선택하는 드롭다운 로직을 포함하라."
산출물: 에디터 내 컴포넌트 팔레트 및 속성 바인딩 로직 설계.
[Phase 3: 클라이언트 상태 머신 및 하드웨어 연동 구현]
프롬프트 지시: "Tauri 2 클라이언트 내부에서 작동할 State Machine을 Rust로 구현하라. Action Chain JSON을 파싱하여 순차적으로 실행하고, 중간에 하드웨어(바코드 스캐너, 프린터) 호출이 끼어들 경우 비동기적으로 대기(Async Wait)하고 재개하는 로직을 작성하라."
산출물: Tauri 백엔드의 액션 실행 엔진 및 하드웨어 추상화 계층(HAL) 코드.
[Phase 4: 테스트 및 검증 (Harness)]
프롬프트 지시: "복잡한 상태(장바구니에 3개 아이템 담기 → 옵션 변경 → 결제 실패 → 재시도)를 시뮬레이션하는 E2E 테스트 코드를 Playwright로 작성하라. 또한, 네트워크가 끊긴 상태에서 주문을 완료하고 로컬 SQLite에 큐잉한 뒤, 재연결 시 서버로 전송되는지 검증하는 하니스를 구축하라."
산출물: 오프라인 동기화 및 복잡한 액션 체인 검증 테스트 스위트.

📚 [마스터 설계서 시리즈] 노코드 키오스크 비즈니스 플랫폼 v3.0
🎯 사전 분석: Xibo와의 근본적 차별점 및 시장 선점 전략
구분
Xibo (기존 디지털 사이니지)
우리의 플랫폼 (키오스크 비즈니스 OS)
핵심 기능
미디어(이미지/동영상) 시간 기반 스케줄링
비즈니스 로직 실행 (주문, 결제, 예약, 대출)
상태 관리
없음 (단순 재생)
전역 상태 머신 (장바구니, 세션, 예약 상태)
데이터 연동
정적 파일 또는 단순 RSS
동적 데이터셋 레지스트리 (SQL/API/실시간)
하드웨어
제한적 (스크린 출력 위주)
동적 드라이버 레지스트리 (프린터, 결제, 스캐너, 센서)
상호작용
터치 최소화 (패시브)
액티브 상호작용 (설문, 선택, 입력, 결제)
확장성
레이아웃 템플릿 제한적
산업군 무관 클론 (도메인 모델 추상화)
타겟
광고주, 매장 홍보
공공기관, 교육, 무인 비즈니스 전체
🏭 산업군 분류 및 공통/특화 컴포넌트 매트릭스
산업군
공통 컴포넌트 (모두 사용)
산업군 특화 컴포넌트
필수 데이터셋
필수 액션 체인 패턴
무인 카페/테이블오더
LargeButton, Text, Image, Modal, TTS
ProductGrid, OptionPicker, CartSidebar, SeatMap
메뉴DB, 재고DB, 프로모션
장바구니→옵션→결제→출력
교통(열차/버스)
LargeButton, Modal, DatePicker
TimeTable, SeatMatrix, TicketPrinter
실시간 시간표API, 좌석DB
시간선택→좌석→결제→발권
스마트 도서관
SearchBar, CardList, BarcodeReader
BookDetail, LoanHistory, ReturnSlot
도서메타DB, 회원DB, 대출이력
스캔→조회→대출/반납→영수증
헬스케어
Chart, DataInput, DeviceStatus
VitalSignReader, HealthGraph, PHRViewer
개인건강기록DB, 측정로그
기기연동→측정→저장→그래프→출력
시니어 교육(현재)
LargeButton, TTS_Text, MediaPlayer
SurveyEmoji, QuizCard, ProgressTracker
교육콘텐츠DB, 설문결과DB
학습→설문→점수→인증서출력
공공서비스(민원)
FormInput, FileUpload, Payment
DocumentSelector, QueueTicket, IDScanner
민원양식DB, 수수료DB
신원확인→선택→결제→발급
📘 [설계서 1] 백엔드: Rust (Axum) Dynamic Resolver 및 메타 엔진
1.1 목적 및 범위
목적: 테넌트별로 정의된 데이터셋(SQL/API/정적)을 동적으로 해석하고, 전역 상태와 액션 체인을 서버 사이드에서 트랜잭션으로 실행하는 메타 엔진 구축
범위: 멀티테넌시 격리, 동적 데이터 소스 해석, 서버 측 액션 실행기, 오프라인 동기화 API, 통계 집계 엔진
1.2 핵심 아키텍처
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Axum)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Auth MW      │  │ Tenant MW    │  │ Rate Limit MW    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌──────────────────┐
│ Dataset       │    │ Action         │    │ Analytics        │
│ Resolver      │    │ Executor       │    │ Aggregator       │
│ (동적 SQL/API)│    │ (트랜잭션)     │    │ (통계 집계)      │
└───────────────┘    └────────────────┘    └──────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Layer (PostgreSQL + Redis)                 │
│  tenants | datasets | global_states | action_chains         │
│  analytics_events (시간 파티셔닝) | audit_logs              │
└─────────────────────────────────────────────────────────────┘


📗 [설계서 2] 프론트엔드: React 노코드 에디터 (비즈니스 로직 빌더)
2.1 목적 및 범위
목적: UI 컴포넌트, 데이터셋, 액션 체인을 시각적으로 연결하여 복잡한 비즈니스 로직을 코드 없이 구축하는 에디터
범위: 반응형 캔버스(15/24/32인치), 데이터셋 바인딩, 액션 체인 빌더, 접근성 자동 검증, 템플릿 직렬화
2.2 핵심 아키텍처
┌─────────────────────────────────────────────────────────────┐
│                   Editor Shell (Layout)                      │
│  ┌────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ Component  │  │   Kiosk Canvas   │  │  Property +    │  │
│  │ Palette    │  │  (반응형 미리보기) │  │  Dataset Panel │  │
│  │ (좌측)     │  │   (중앙)         │  │  (우측)        │  │
│  └────────────┘  └──────────────────┘  └────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Action Chain Builder (하단, 노드 에디터)      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Zustand Stores (전역 상태)                      │
│  useEditorStore | useDatasetStore | useActionStore          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Template Serializer (JSON)

2.3 핵심 모듈 상세 설계
2.3.1 공통 컴포넌트 라이브러리 (모든 산업군 공유)
// src/editor/components/common/index.ts
// 모든 산업군에서 재사용되는 기본 컴포넌트

export const COMMON_COMPONENTS = {
  // 시니어 친화적 대형 버튼 (최소 64x64px)
  LargeButton: {
    displayName: '대형 버튼',
    category: 'common',
    defaultProps: {
      label: '버튼',
      ttsLabel: '버튼을 눌러주세요', // 음성 안내 필수
      backgroundColor: '#1A365D',
      textColor: '#FFFFFF',
      fontSize: 28,
      borderRadius: 16,
    },
    // 접근성 검증 규칙
    validationRules: {
      minTouchTarget: 64,
      minContrastRatio: 4.5,
      requireTtsLabel: true,
    },
  },
  
  // TTS 지원 텍스트
  TTS_Text: {
    displayName: '음성 안내 텍스트',
    category: 'common',
    defaultProps: {
      content: '',
      autoRead: true, // 화면 진입 시 자동 읽기
      voiceType: 'senior_female', // 고령자 친화적 음성
      readingSpeed: 0.9,
    },
  },
  
  // 모달 (옵션 선택, 확인 등)
  Modal: {
    displayName: '모달 팝업',
    category: 'common',
    defaultProps: {
      title: '',
      closeOnOutsideClick: false, // 시니어 실수 방지
      showCloseButton: true,
      closeButtonSize: 48,
    },
  },
  
  // 날짜/시간 선택기 (교통, 예약용)
  DatePicker: {
    displayName: '날짜 선택',
    category: 'common',
    defaultProps: {
      format: 'YYYY-MM-DD',
      largeFont: true,
      showWeekdays: true,
    },
  },
  
  // 검색창
  SearchBar: {
    displayName: '검색창',
    category: 'common',
    defaultProps: {
      placeholder: '검색어를 입력하세요',
      fontSize: 24,
      showClearButton: true,
    },
  },
};

2.3.2 산업군 특화 컴포넌트 (도메인별 플러그인)
// src/editor/components/domains/cafe/index.ts
// 무인 카페/테이블오더 특화 컴포넌트

export const CAFE_COMPONENTS = {
  ProductGrid: {
    displayName: '상품 그리드',
    category: 'cafe',
    defaultProps: {
      columns: 3,
      cardWidth: '30%',
      showImage: true,
      showPrice: true,
      showStock: true,
    },
    // 데이터셋 바인딩 가능 필드
    bindableFields: ['name', 'price', 'imageUrl', 'stock', 'category'],
  },
  
  OptionPicker: {
    displayName: '옵션 선택기',
    category: 'cafe',
    defaultProps: {
      optionType: 'single', // single | multi
      showPriceDiff: true,
    },
    bindableFields: ['optionName', 'priceDiff', 'isDefault'],
  },
  
  CartSidebar: {
    displayName: '장바구니 사이드바',
    category: 'cafe',
    defaultProps: {
      position: 'right',
      showTotal: true,
      showQuantityControl: true,
    },
    // 전역 상태 'cart' 자동 바인딩
    autoBindState: 'cart',
  },
};

// src/editor/components/domains/transport/index.ts
// 교통(열차/버스) 특화 컴포넌트

export const TRANSPORT_COMPONENTS = {
  SeatMatrix: {
    displayName: '좌석 매트릭스',
    category: 'transport',
    defaultProps: {
      rows: 10,
      cols: 4,
      seatSize: 60,
      showLegend: true,
    },
    bindableFields: ['seatNumber', 'status', 'price', 'class'],
  },
  
  TimeTable: {
    displayName: '시간표 리스트',
    category: 'transport',
    defaultProps: {
      showDeparture: true,
      showArrival: true,
      showDuration: true,
    },
    bindableFields: ['departureTime', 'arrivalTime', 'price', 'availableSeats'],
  },
};

// src/editor/components/domains/library/index.ts
// 스마트 도서관 특화 컴포넌트

export const LIBRARY_COMPONENTS = {
  BarcodeReader: {
    displayName: '바코드 리더 영역',
    category: 'library',
    defaultProps: {
      autoDetect: true,
      showGuide: true,
      hardwareType: 'barcode_scanner',
    },
  },
  
  BookDetail: {
    displayName: '도서 상세 카드',
    category: 'library',
    defaultProps: {
      showCover: true,
      showSummary: true,
      showAvailability: true,
    },
    bindableFields: ['title', 'author', 'coverUrl', 'summary', 'isAvailable'],
  },
};

2.3.3 데이터셋 바인딩 엔진 (Drag & Drop)
// src/editor/engine/bindingEngine.ts
// 데이터셋을 컴포넌트에 드래그하여 바인딩하는 핵심 로직

export interface BindingResult {
  datasetId: string;
  fieldMapping: Record<string, string>; // 컴포넌트 필드 → 데이터셋 필드
  transformRules?: Record<string, TransformRule>; // 데이터 변환 규칙
}

export const createBinding = (
  component: ComponentNode,
  dataset: DatasetDefinition,
): BindingResult => {
  const fieldMapping: Record<string, string> = {};
  
  // 1. 자동 매핑: 이름이 유사한 필드 자동 연결
  component.bindableFields?.forEach((compField) => {
    const matchedDatasetField = dataset.schema.fields.find(
      (dsField) => 
        dsField.key.toLowerCase() === compField.toLowerCase() ||
        dsField.key.toLowerCase().includes(compField.toLowerCase())
    );
    if (matchedDatasetField) {
      fieldMapping[compField] = matchedDatasetField.key;
    }
  });
  
  // 2. 수동 매핑: 자동 매핑 실패 시 관리자가 UI에서 직접 연결
  // (PropertyPanel에서 드롭다운으로 선택 가능)
  
  return {
    datasetId: dataset.id,
    fieldMapping,
  };
};

// 3. 데이터 변환 규칙 (가격 포맷, 날짜 포맷 등)
export const applyTransform = (
  value: any,
  rule: TransformRule,
): any => {
  switch (rule.type) {
    case 'CURRENCY':
      return `${value.toLocaleString()}원`;
    case 'DATE':
      return dayjs(value).format(rule.format || 'YYYY-MM-DD');
    case 'BOOLEAN_TO_ICON':
      return value ? '✅' : '❌';
    default:
      return value;
  }
};
2.3.4 액션 체인 빌더 (시각적 노드 에디터)
// src/editor/engine/actionChainBuilder.ts
// 버튼 클릭 시 실행될 다중 단계 로직을 노드로 조립

export type ActionType = 
  | 'UPDATE_STATE'      // 전역 상태 업데이트 (장바구니 추가 등)
  | 'OPEN_MODAL'        // 모달 열기
  | 'CLOSE_MODAL'       // 모달 닫기
  | 'NAVIGATE'          // 페이지 이동
  | 'CALL_API'          // 서버 API 호출
  | 'EXECUTE_DRIVER'    // 하드웨어 드라이버 실행
  | 'WAIT_HARDWARE'     // 하드웨어 입력 대기 (바코드, 카드)
  | 'DB_TRANSACTION'    // 서버 측 DB 트랜잭션
  | 'SHOW_TOAST'        // 토스트 메시지
  | 'PLAY_SOUND'        // 효과음 재생
  | 'CONDITIONAL'       // 조건 분기 (if-else)

export interface ActionNode {
  id: string;
  type: ActionType;
  config: Record<string, any>;
  onError?: {
    policy: 'RETRY' | 'SKIP' | 'ROLLBACK' | 'SHOW_MODAL';
    config: any;
  };
  nextNodeId?: string; // 조건부 분기 시
}

// 액션 체인 실행 시뮬레이터 (에디터에서 테스트 가능)
export const simulateActionChain = async (
  chain: ActionChain,
  initialState: GlobalState,
): Promise<SimulationResult> => {
  let state = { ...initialState };
  const logs: SimulationLog[] = [];
  
  for (const node of chain.nodes) {
    try {
      logs.push({ nodeId: node.id, status: 'STARTED', timestamp: Date.now() });
      state = await executeNode(node, state);
      logs.push({ nodeId: node.id, status: 'COMPLETED', timestamp: Date.now() });
    } catch (error) {
      logs.push({ nodeId: node.id, status: 'FAILED', error: error.message, timestamp: Date.now() });
      
      // 에러 정책 처리
      if (node.onError?.policy === 'SKIP') continue;
      if (node.onError?.policy === 'ROLLBACK') return { success: false, state: initialState, logs };
      // ... 기타 정책 처리
    }
  }
  
  return { success: true, state, logs };
};

2.3.5 접근성 자동 검증 게이트
// src/editor/engine/accessibilityValidator.ts
// 게시(Publish) 전 필수 검증

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export const validateAccessibility = (schema: TemplateSchema): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  schema.pages.forEach((page) => {
    page.components.forEach((comp) => {
      // 1. 터치 타겟 크기 검증 (최소 64x64px)
      const bounds = calculatePixelBounds(comp, schema.metadata.targetDevices);
      if (bounds.width < 64 || bounds.height < 64) {
        errors.push({
          componentId: comp.id,
          rule: 'MIN_TOUCH_TARGET',
          message: `터치 영역이 64px 미만입니다. (현재: ${bounds.width}x${bounds.height})`,
        });
      }
      
      // 2. 색상 대비율 검증 (WCAG AAA: 7:1)
      if (comp.props.backgroundColor && comp.props.textColor) {
        const ratio = calculateContrastRatio(comp.props.backgroundColor, comp.props.textColor);
        if (ratio < 7) {
          errors.push({
            componentId: comp.id,
            rule: 'MIN_CONTRAST_RATIO',
            message: `색상 대비율이 7:1 미만입니다. (현재: ${ratio.toFixed(2)}:1)`,
          });
        }
      }
      
      // 3. TTS 라벨 필수 여부 검증
      const componentDef = getComponentDefinition(comp.type);
      if (componentDef.validationRules?.requireTtsLabel && !comp.props.ttsLabel) {
        errors.push({
          componentId: comp.id,
          rule: 'REQUIRE_TTS_LABEL',
          message: '음성 안내(TTS) 텍스트가 필요합니다.',
        });
      }
      
      // 4. 경고: 버튼 간격 8px 미만
      // ... (인접 컴포넌트와의 거리 계산)
    });
  });
  
  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
};

2.4 확장 포인트
새로운 산업군 추가: src/editor/components/domains/에 새 폴더 추가 및 COMPONENT_REGISTRY에 등록
새로운 컴포넌트 추가: 공통/특화 컴포넌트 정의 파일에 추가하면 팔레트에 자동 반영
새로운 액션 타입 추가: ActionType에 추가하고 ActionNodeEditor에 UI 추가
2.5 리스크 및 대응
리스크
영향도
대응 방안
복잡한 액션 체인 작성 시 관리자 혼란
높음
실행 시뮬레이터 제공, 템플릿 예제 라이브러리
반응형 레이아웃 깨짐 (15/24/32인치)
높음
% 단위 강제, 디바이스별 프리뷰 토글
접근성 검증 우회 시도
중간
게시 버튼 자체를 비활성화 (강제 차단)

📙 [설계서 3] 클라이언트: Tauri 2 State Machine 및 Action Executor
3.1 목적 및 범위
목적: 키오스크 클라이언트 내에서 JSON 템플릿을 파싱하고, 전역 상태를 관리하며, 액션 체인을 순차 실행하고, 하드웨어 이벤트를 처리하는 경량 런타임 엔진
범위: 템플릿 파서, 전역 상태 스토어, 액션 실행기, 하드웨어 추상화 계층(HAL), 오프라인 동기화 에이전트
3.2 핵심 아키텍처
┌─────────────────────────────────────────────────────────────┐
│                Tauri 2 Kiosk Client                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Webview (React/Dioxus)                  │   │
│  │   Template Renderer + UI Components + TTS Engine     │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↕ IPC                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Rust Backend (Tauri Core)               │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Template    │  │ State        │  │ Action     │  │   │
│  │  │ Parser      │  │ Machine      │  │ Executor   │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘  │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Hardware    │  │ Offline      │  │ Telemetry  │  │   │
│  │  │ HAL         │  │ Sync Agent   │  │ Collector  │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↕                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Local Storage (SQLite)                  │   │
│  │  cached_templates | pending_events | global_state    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

3.3 핵심 모듈 상세 설계
3.3.1 Template Parser (템플릿 파서)
// src-tauri/src/engine/template_parser.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateSchema {
    pub schema_version: String,
    pub metadata: TemplateMetadata,
    pub pages: Vec<Page>,
    pub action_chains: HashMap<String, ActionChain>,
    pub global_state: GlobalStateDefinition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub id: String,
    pub name: String,
    pub components: Vec<ComponentInstance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentInstance {
    pub id: String,
    pub component_type: String,
    pub position: Position,
    pub size: Size,
    pub props: serde_json::Value,
    pub dataset_binding: Option<DatasetBinding>,
    pub action_chain_id: Option<String>,
}

pub struct TemplateParser;

impl TemplateParser {
    // JSON 스키마를 파싱하여 런타임 객체로 변환
    pub fn parse(json: &str) -> Result<TemplateSchema, ParseError> {
        let schema: TemplateSchema = serde_json::from_str(json)?;
        
        // 1. 스키마 버전 호환성 검증
        Self::validate_version(&schema)?;
        
        // 2. 컴포넌트 타입 유효성 검증 (레지스트리에 존재하는지)
        Self::validate_component_types(&schema)?;
        
        // 3. 액션 체인 참조 무결성 검증
        Self::validate_action_chain_refs(&schema)?;
        
        Ok(schema)
    }
    
    fn validate_version(schema: &TemplateSchema) -> Result<(), ParseError> {
        if schema.schema_version != "2.0" {
            // 하위 호환성 마이그레이션 로직
            return Err(ParseError::UnsupportedVersion);
        }
        Ok(())
    }
}

3.3.2 Global State Machine (전역 상태 머신)
// src-tauri/src/engine/state_machine.rs
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// 키오스크 세션 동안 유지되는 전역 상태
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalState {
    pub cart: Vec<CartItem>,
    pub user_session: Option<UserSession>,
    pub booking: Option<BookingState>,
    pub custom: HashMap<String, serde_json::Value>, // 테넌트 정의 확장 상태
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartItem {
    pub product_id: String,
    pub name: String,
    pub quantity: u32,
    pub options: HashMap<String, String>,
    pub unit_price: u32,
}

pub struct StateMachine {
    state: Arc<RwLock<GlobalState>>,
    persistence: LocalPersistence, // SQLite
}

impl StateMachine {
    pub async fn update_state<F>(&self, updater: F) -> Result<(), StateError>
    where
        F: FnOnce(&mut GlobalState),
    {
        let mut state = self.state.write().await;
        updater(&mut state);
        
        // 상태 변경 시 자동으로 로컬 SQLite에 스냅샷 저장 (크래시 대비)
        self.persistence.save_state_snapshot(&state).await?;
        
        // UI에 상태 변경 알림 (React 구독자 업데이트)
        self.notify_subscribers(&state).await;
        
        Ok(())
    }
    
    // 앱 시작 시 이전 상태 복구 (크래시/재부팅 대응)
    pub async fn restore_from_crash(&self) -> Result<(), StateError> {
        if let Some(snapshot) = self.persistence.load_last_snapshot().await? {
            let mut state = self.state.write().await;
            *state = snapshot;
            tracing::info!("Restored state from crash snapshot");
        }
        Ok(())
    }
    
    // 세션 타임아웃 시 상태 초기화 (시니어 미사용 대응)
    pub async fn reset_for_new_session(&self) -> Result<(), StateError> {
        let mut state = self.state.write().await;
        *state = GlobalState::default();
        self.persistence.save_state_snapshot(&state).await?;
        Ok(())
    }
}

3.3.3 Action Executor (액션 실행기)
// src-tauri/src/engine/action_executor.rs
use async_trait::async_trait;

// 액션 실행 컨텍스트 (상태 머신, 하드웨어 HAL, 서버 통신 포함)
pub struct ActionContext {
    pub state_machine: Arc<StateMachine>,
    pub hardware_hal: Arc<HardwareHAL>,
    pub server_client: Arc<ServerClient>,
    pub device_id: String,
}

#[async_trait]
pub trait ActionHandler: Send + Sync {
    async fn execute(&self, node: &ActionNode, ctx: &mut ActionContext) -> Result<(), ActionError>;
}

pub struct ActionExecutor {
    handlers: HashMap<ActionType, Box<dyn ActionHandler>>,
}

impl ActionExecutor {
    pub async fn execute_chain(
        &self,
        chain_id: &str,
        ctx: &mut ActionContext,
    ) -> Result<ActionResult, ActionError> {
        let chain = ctx.get_action_chain(chain_id).await?;
        
        for node in &chain.nodes {
            let handler = self.handlers
                .get(&node.action_type)
                .ok_or(ActionError::UnknownActionType)?;
            
            match handler.execute(node, ctx).await {
                Ok(_) => continue,
                Err(e) => {
                    tracing::error!("Action node {} failed: {:?}", node.id, e);
                    
                    // 에러 정책 처리
                    match &node.on_error {
                        Some(ErrorPolicy::Retry { max_attempts, delay_ms }) => {
                            for attempt in 1..=*max_attempts {
                                tokio::time::sleep(Duration::from_millis(*delay_ms)).await;
                                if handler.execute(node, ctx).await.is_ok() {
                                    break;
                                }
                                if attempt == *max_attempts {
                                    return Err(e);
                                }
                            }
                        }
                        Some(ErrorPolicy::Skip) => continue,
                        Some(ErrorPolicy::ShowModal { modal_id }) => {
                            ctx.show_modal(modal_id).await?;
                            return Err(e);
                        }
                        None => return Err(e),
                    }
                }
            }
        }
        
        Ok(ActionResult::Success)
    }
}

// 개별 액션 핸들러 예시: 하드웨어 대기
pub struct WaitHardwareHandler;

#[async_trait]
impl ActionHandler for WaitHardwareHandler {
    async fn execute(&self, node: &ActionNode, ctx: &mut ActionContext) -> Result<(), ActionError> {
        let hardware_type = node.config["hardware_type"].as_str().unwrap();
        let timeout_ms = node.config["timeout_ms"].as_u64().unwrap_or(30000);
        
        // 하드웨어 HAL을 통해 입력 대기 (바코드 스캐너, 카드 리더 등)
        let result = tokio::time::timeout(
            Duration::from_millis(timeout_ms),
            ctx.hardware_hal.wait_for_input(hardware_type),
        )
        .await
        .map_err(|_| ActionError::HardwareTimeout)?;
        
        // 입력 결과를 전역 상태에 저장 (다음 노드에서 사용)
        ctx.state_machine.update_state(|state| {
            state.custom.insert("last_hardware_input".to_string(), result.clone());
        }).await?;
        
        Ok(())
    }
}

3.3.4 Hardware HAL (하드웨어 추상화 계층)
// src-tauri/src/hardware/hal.rs
use async_trait::async_trait;

#[async_trait]
pub trait HardwareDriver: Send + Sync {
    async fn initialize(&self, config: &DriverConfig) -> Result<(), HardwareError>;
    async fn execute(&self, command: &HardwareCommand) -> Result<HardwareResult, HardwareError>;
    async fn wait_for_input(&self) -> Result<serde_json::Value, HardwareError>;
    async fn shutdown(&self) -> Result<(), HardwareError>;
}

pub struct HardwareHAL {
    drivers: Arc<RwLock<HashMap<String, Box<dyn HardwareDriver>>>>,
    registry: HardwareRegistry, // 서버에서 동기화된 드라이버 레지스트리
}

impl HardwareHAL {
    // 서버에서 동기화된 드라이버 레지스트리를 기반으로 드라이버 동적 로드
    pub async fn sync_drivers_from_server(&self) -> Result<(), HardwareError> {
        let drivers = self.registry.fetch_all().await?;
        let mut loaded = self.drivers.write().await;
        
        for driver_config in drivers {
            let driver: Box<dyn HardwareDriver> = match driver_config.driver_type {
                DriverType::Real => {
                    match driver_config.connection_type.as_str() {
                        "serial" => Box::new(SerialDriver::new()),
                        "usb_hid" => Box::new(UsbHidDriver::new()),
                        "network" => Box::new(NetworkDriver::new()),
                        _ => return Err(HardwareError::UnsupportedConnectionType),
                    }
                }
                DriverType::Simulation => Box::new(SimulationDriver::new()),
            };
            
            driver.initialize(&driver_config).await?;
            loaded.insert(driver_config.driver_id.clone(), driver);
        }
        
        Ok(())
    }
    
    // 드라이버 실행 (시뮬레이션 모드이면 실제 포트 열지 않음)
    pub async fn execute_command(
        &self,
        driver_id: &str,
        command: &HardwareCommand,
    ) -> Result<HardwareResult, HardwareError> {
        let drivers = self.drivers.read().await;
        let driver = drivers
            .get(driver_id)
            .ok_or(HardwareError::DriverNotFound)?;
        
        match driver.execute(command).await {
            Ok(result) => {
                // 실행 결과를 서버에 로그 전송 (원격 진단용)
                self.log_hardware_event(driver_id, command, &result).await;
                Ok(result)
            }
            Err(e) => {
                // 하드웨어 오류 시 시뮬레이션 모드로 자동 폴백 (교육 흐름 유지)
                if let Some(sim_driver) = self.get_simulation_fallback(driver_id).await {
                    tracing::warn!("Real driver failed, falling back to simulation: {:?}", e);
                    return sim_driver.execute(command).await;
                }
                Err(e)
            }
        }
    }
}

3.3.5 Offline Sync Agent (오프라인 동기화 에이전트)
// src-tauri/src/sync/offline_agent.rs
use sqlx::SqlitePool;

pub struct OfflineSyncAgent {
    local_db: SqlitePool,
    server_client: Arc<ServerClient>,
    network_monitor: Arc<NetworkMonitor>,
}

impl OfflineSyncAgent {
    // 백그라운드 워커: 30초마다 네트워크 상태 확인 및 큐 비우기
    pub async fn run_sync_loop(self: Arc<Self>) {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        
        loop {
            interval.tick().await;
            
            if self.network_monitor.is_online().await {
                if let Err(e) = self.flush_pending_events().await {
                    tracing::error!("Failed to flush pending events: {:?}", e);
                }
            }
        }
    }
    
    // 로컬 SQLite에 쌓인 이벤트들을 서버로 배치 전송
    async fn flush_pending_events(&self) -> Result<(), SyncError> {
        // 1. pending 상태의 이벤트들을 배치로 조회 (최대 100개씩)
        let events = sqlx::query_as::<_, PendingEvent>(
            "SELECT * FROM pending_events WHERE status = 'pending' ORDER BY created_at LIMIT 100"
        )
        .fetch_all(&self.local_db)
        .await?;
        
        if events.is_empty() {
            return Ok(());
        }
        
        // 2. 서버 API로 배치 전송
        match self.server_client.submit_analytics_batch(&events).await {
            Ok(_) => {
                // 3. 전송 성공 시 로컬에서 삭제
                let ids: Vec<String> = events.iter().map(|e| e.id.clone()).collect();
                sqlx::query("DELETE FROM pending_events WHERE id = ANY($1)")
                    .bind(&ids)
                    .execute(&self.local_db)
                    .await?;
                
                tracing::info!("Flushed {} events to server", events.len());
            }
            Err(e) => {
                tracing::warn!("Server submit failed, keeping events in queue: {:?}", e);
                // 실패 시 재시도 카운트 증가 (너무 오래된 이벤트는 폐기)
                self.increment_retry_counts(&events).await?;
            }
        }
        
        Ok(())
    }
    
    // 키오스크에서 이벤트 발생 시 호출 (오프라인이면 로컬 큐잉, 온라인이면 즉시 전송)
    pub async fn record_event(&self, event: AnalyticsEvent) -> Result<(), SyncError> {
        if self.network_monitor.is_online().await {
            // 온라인: 즉시 전송 시도, 실패 시 큐잉
            match self.server_client.submit_analytics_batch(&[event.clone()]).await {
                Ok(_) => return Ok(()),
                Err(_) => { /* 큐잉으로 진행 */ }
            }
        }
        
        // 오프라인 또는 전송 실패: 로컬 SQLite에 저장
        sqlx::query(
            "INSERT INTO pending_events (id, event_type, payload, status, created_at) VALUES ($1, $2, $3, 'pending', NOW())"
        )
        .bind(&event.id)
        .bind(&event.event_type)
        .bind(&event.payload)
        .execute(&self.local_db)
        .await?;
        
        Ok(())
    }
}

3.4 확장 포인트
새로운 하드웨어 타입 추가: HardwareDriver 트레이트 구현 후 HardwareHAL에 등록
새로운 액션 타입 추가: ActionHandler 트레이트 구현 후 ActionExecutor에 등록
새로운 데이터 소스 타입: 서버 측 Dynamic Resolver와 연동하여 자동 지원
3.5 리스크 및 대응
리스크
영향도
대응 방안
Tauri Android 지원 불안정
중간
핵심 기능은 Windows/Linux Tauri, Android는 TWA로 이원화
하드웨어 드라이버 충돌
높음
HAL 추상화 + 시뮬레이션 자동 폴백
오프라인 장기화로 로컬 DB 과부하
중간
이벤트 TTL 설정 (7일 이상 오래된 이벤트는 폐기)
상태 머신 크래시 시 데이터 유실
치명적
beforeunload 이벤트에서 SQLite 스냅샷 저장

🎯 총괄 PM의 최종 종합 및 시장 선점 전략
핵심 차별화 포인트 (Xibo 대비)
비즈니스 로직 실행 엔진: 단순 표시가 아닌 주문/결제/예약/대출 등 실제 비즈니스 트랜잭션 처리
메타 모델링 아키텍처: 데이터셋 + 액션 체인 + 전역 상태의 3층 추상화로 어떤 산업군도 코드 없이 클론
동적 하드웨어 레지스트리: 관리자가 드라이버를 실시간 추가/삭제/교체 가능 (재배포 불필요)
오프라인 퍼스트: 폐쇄형 로컬 클라우드에서도 완전 작동, 네트워크 복원 시 자동 동기화
시니어 접근성 강제: 자동 검증 게이트로 어떤 관리자가 만들어도 WCAG AAA 준수
시장 선점 로드맵
Phase
기간
목표
산출물
Phase 1
1-2개월
백엔드 메타 엔진 + 멀티테넌시
Rust Axum 서버, DB 스키마, API
Phase 2
2-3개월
노코드 에디터 + 공통 컴포넌트
React 에디터, 시니어 교육 템플릿 3종
Phase 3
2-3개월
Tauri 클라이언트 + 하드웨어 HAL
Windows/Linux 키오스크 앱, Bixolon 연동
Phase 4
1-2개월
산업군 확장 (카페, 도서관, 교통)
도메인별 컴포넌트, 실증 테스트
Phase 5
1개월
통계 대시보드 + 모바일 모니터링
Recharts 시각화, PWA/TWA 관리자 앱

📚 [마스터 프롬프트 설계서 v4.0] Xibo 아키텍처 기반 키오스크 비즈니스 OS
사용 지침: 아래의 각 블록은 개발팀이나 AI 코딩 에이전트에게 투입할 최상위 마스터 프롬프트입니다. 이 프롬프트를 그대로 복사하여 투입하면, 마스터님이 의도한 깊이 있는 분석과 설계가 코드화되기 전 단계까지 완벽하게 도출됩니다.
🎯 1. Xibo 핵심 개념의 키오스크 비즈니스 OS 적용 전략 (Gap Analysis)
Xibo 개념 (디지털 사이니지)
우리 플랫폼 적용 개념 (키오스크 비즈니스 OS)
고도화 및 차별화 포인트 (마스터 PM 설계)
Layout (레이아웃)
Page Template (페이지 템플릿)
단순 배치가 아닌, 15/24/32인치 해상도에 따라 그리드가 자동 재배치되는 반응형 메타 레이아웃으로 정의.
Region (리전)
Interactive Component Zone (상호작용 컴포넌트 존)
미디어 재생 영역이 아닌, 드래그앤드롭으로 배치되고 데이터셋 바인딩 및 액션 체인이 할당되는 동적 UI 존.
DataSet (데이터셋)
Dynamic Dataset Registry (동적 데이터 레지스트리)
Xibo의 정적 DataSet을 넘어, SQL/API를 파라미터화하여 실시간 재고, 좌석, 도서 정보를 주입하는 메타 데이터 엔진으로 확장.
Display Group
Kiosk Device Group (키오스크 기기 그룹)
단순 화면 그룹이 아닌, 하드웨어 UUID, 설치 위치(센터), 허용된 드라이버(프린터/결제)가 묶인 물리적/논리적 관리 단위.
Campaign / Schedule
Business Flow & State Machine (비즈니스 플로우)
시간 기반 스케줄링이 아닌, 시작 → 메뉴선택 → 장바구니 → 결제 → 출력과 같은 이벤트 기반 상태 머신으로 대체.
Permissions / Features
Multi-Tenant RBAC + Feature Flags
Xibo의 공유 모델을 계승하되, 테넌트 간 데이터 격리(RLS)와 센터장/강사/관리자별 기능 사용 제한(Feature Flag) 을 강제.

📝 2. 마스터 프롬프트 세트 (개발/AI 투입용)
[프롬프트 1] 시스템 분석 및 메타 아키텍처 설계
# 역할 부여
당신은 시니어 교육 및 무인 키오스크 시장을 선점할 '메타 모델링 기반 키오스크 비즈니스 OS'의 수석 시스템 아키텍트입니다. Xibo의 계층적 구조(Layout-Region-DataSet)를 참고하되, 복잡한 비즈니스 로직(주문, 결제, 예약, 대출)을 처리할 수 있도록 고도화해야 합니다.

# 작업 지시
다음 요구사항을 충족하는 시스템 아키텍처 분석 및 설계 문서를 마크다운으로 작성하십시오. 코드 구현이 아닌, 개념적 모델링과 데이터 흐름에 집중하십시오.

# 핵심 설계 요구사항
1. 메타 모델링 엔진: 관리자가 UI에서 정의한 '데이터셋(SQL/API)'과 '컴포넌트 속성'을 동적으로 바인딩하여 화면을 렌더링하는 아키텍처를 설계하십시오.
2. 하이브리드 배포 지원: 퍼블릭 클라우드와 센터 로컬 폐쇄형 클라우드(On-Premise)에서 동일한 코드베이스로 작동하도록, 컨테이너화 및 로컬 캐싱/동기화 전략을 포함하십시오.
3. 상태 관리(State Management): 키오스크 세션 동안 유지되어야 하는 전역 상태(예: 장바구니, 로그인 세션, 예약 정보)의 생명주기와 크래시 복구(Crash Recovery) 메커니즘을 설계하십시오.
4. 확장성: 향후 새로운 산업군(헬스케어, 스마트 도서관, 교통)이 추가될 때, 핵심 엔진을 수정하지 않고 '도메인별 컴포넌트 플러그인'만 추가하여 대응할 수 있는 아키텍처 패턴을 제시하십시오.

# 산출물 형식
- 시스템 컨텍스트 다이어그램 (Mermaid 또는 텍스트 기반 구조)
- 핵심 모듈별 책임과 상호작용 흐름 (Sequence Flow)
- 확장성을 위한 아키텍처 패턴 (예: Strategy Pattern, Plugin Architecture) 설명
[프롬프트 2] 멀티테넌시 RBAC 및 권한 모델 설계
# 역할 부여
당신은 엔터프라이즈급 SaaS 보안 및 권한 관리 전문가입니다. Xibo의 'User Groups & Features' 모델을 참고하여, 우리 플랫폼의 멀티테넌시 환경에서 절대적인 데이터 격리와 세밀한 접근 통제를 설계해야 합니다.

# 작업 지시
슈퍼 관리자, 테넌트 관리자(센터장), 그룹 관리자(강사), 디바이스 운영자(현장)의 4단계 권한 모델을 기반으로 한 RBAC(Role-Based Access Control) 설계 문서를 작성하십시오.

# 핵심 설계 요구사항
1. 데이터 격리 (Data Isolation): 멀티테넌트 환경에서 테넌트 A의 데이터(템플릿, 데이터셋, 통계)가 테넌트 B에게 절대 노출되지 않도록 하는 DB 레벨(Row-Level Security) 및 미들웨어 레벨의 강제 필터링 전략을 수립하십시오.
2. 리소스 공유 및 상속: 슈퍼 관리자가 생성한 '마스터 템플릿'을 테넌트가 복사하여 수정할 수 있지만, 마스터 템플릿의 핵심 구조는 보호되는 상속(Inheritance) 및 버전 관리 모델을 설계하십시오.
3. 기능 플래그 (Feature Flags): 테넌트의 계약 등급이나 역할에 따라 특정 컴포넌트(예: 고급 결제 모듈, 특정 하드웨어 드라이버)의 사용 여부를 동적으로 제어하는 메커니즘을 설계하십시오.
4. 감사 로그 (Audit Logging): 템플릿 수정, 하드웨어 설정 변경, 게시 승인 등 모든 중요한 행동에 대한 추적 불가능성(Non-repudiation)을 보장하는 로그 구조를 정의하십시오.

# 산출물 형식
- 역할(Role)별 권한 매트릭스 (CRUD 및 특수 액션 포함)
- 멀티테넌시 데이터 격리를 위한 DB 스키마 전략 (Tenant ID 활용 방안)
- 리소스 접근 제어 흐름도 (Access Control Flow)

[프롬프트 2] 멀티테넌시 RBAC 및 권한 모델 설계
# 역할 부여
당신은 엔터프라이즈급 SaaS 보안 및 권한 관리 전문가입니다. Xibo의 'User Groups & Features' 모델을 참고하여, 우리 플랫폼의 멀티테넌시 환경에서 절대적인 데이터 격리와 세밀한 접근 통제를 설계해야 합니다.

# 작업 지시
슈퍼 관리자, 테넌트 관리자(센터장), 그룹 관리자(강사), 디바이스 운영자(현장)의 4단계 권한 모델을 기반으로 한 RBAC(Role-Based Access Control) 설계 문서를 작성하십시오.

# 핵심 설계 요구사항
1. 데이터 격리 (Data Isolation): 멀티테넌트 환경에서 테넌트 A의 데이터(템플릿, 데이터셋, 통계)가 테넌트 B에게 절대 노출되지 않도록 하는 DB 레벨(Row-Level Security) 및 미들웨어 레벨의 강제 필터링 전략을 수립하십시오.
2. 리소스 공유 및 상속: 슈퍼 관리자가 생성한 '마스터 템플릿'을 테넌트가 복사하여 수정할 수 있지만, 마스터 템플릿의 핵심 구조는 보호되는 상속(Inheritance) 및 버전 관리 모델을 설계하십시오.
3. 기능 플래그 (Feature Flags): 테넌트의 계약 등급이나 역할에 따라 특정 컴포넌트(예: 고급 결제 모듈, 특정 하드웨어 드라이버)의 사용 여부를 동적으로 제어하는 메커니즘을 설계하십시오.
4. 감사 로그 (Audit Logging): 템플릿 수정, 하드웨어 설정 변경, 게시 승인 등 모든 중요한 행동에 대한 추적 불가능성(Non-repudiation)을 보장하는 로그 구조를 정의하십시오.

# 산출물 형식
- 역할(Role)별 권한 매트릭스 (CRUD 및 특수 액션 포함)
- 멀티테넌시 데이터 격리를 위한 DB 스키마 전략 (Tenant ID 활용 방안)
- 리소스 접근 제어 흐름도 (Access Control Flow)

[프롬프트 3] 노코드 비즈니스 로직 빌더 (레이아웃/데이터셋/액션) 설계
# 역할 부여
당신은 노코드/로우코드 플랫폼(Figma, FlutterFlow, Webflow)의 UX/UI 및 내부 엔진 설계 전문가입니다. Xibo의 Layout Editor를 뛰어넘어, '비즈니스 로직'까지 시각적으로 조립할 수 있는 에디터를 설계해야 합니다.

# 작업 지시
관리자가 드래그앤드롭으로 키오스크 화면을 구성하고, 데이터와 행동을 연결할 수 있는 에디터의 구조와 작동 원리를 상세히 설계하십시오.

# 핵심 설계 요구사항
1. 컴포넌트 계층 구조: 공통 컴포넌트(버튼, 텍스트, 모달)와 산업군 특화 컴포넌트(상품 그리드, 좌석 매트릭스, 바코드 리더 영역)를 명확히 분류하고, 이들이 에디터 팔레트에 어떻게 등록되고 렌더링되는지 정의하십시오.
2. 동적 데이터 바인딩 (Dynamic Data Binding): 우측 패널의 '데이터셋 레지스트리'에서 특정 데이터 소스를 드래그하여 컴포넌트(예: 상품 그리드)에 드롭했을 때, 필드 매핑(Field Mapping)이 자동으로 또는 반자동으로 이루어지는 UX와 내부 데이터 구조(JSON 스키마)를 설계하십시오.
3. 액션 체인 빌더 (Action Chain Builder): 컴포넌트(예: '결제하기' 버튼)에 클릭 이벤트를 할당할 때, 단순 페이지 이동이 아닌 `[장바구니 상태 업데이트] → [서버 API 호출] → [하드웨어 드라이버(프린터) 실행] → [완료 화면 이동]`과 같은 다중 단계를 시각적 노드로 연결하는 에디터의 구조를 설계하십시오.
4. 접근성 자동 검증 게이트 (Accessibility Gate): '게시(Publish)' 버튼을 누르는 순간, 시니어 친화성(최소 터치 타겟 64px, 색상 대비율 4.5:1 이상, TTS 라벨 존재 여부)을 자동으로 검사하고 실패 시 배포를 차단하는 검증 로직의 규칙을 정의하십시오.

# 산출물 형식
- 에디터 화면 레이아웃 와이어프레임 설명 (좌측 팔레트, 중앙 캔버스, 우측 속성/데이터 패널, 하단 액션 빌더)
- 템플릿 직렬화를 위한 최종 JSON 스키마 구조 (메타데이터, 페이지, 컴포넌트, 데이터 바인딩, 액션 체인 포함)
- 접근성 검증 규칙 체크리스트

[프롬프트 4] 키오스크 클라이언트 동기화 및 하드웨어 추상화(HAL) 설계
# 역할 부여
당신은 임베디드 시스템 및 엣지 컴퓨팅(Edge Computing) 전문가입니다. Tauri 2 기반의 키오스크 클라이언트가 서버와 독립적으로 안정적으로 작동하면서도, 필요할 때 완벽하게 동기화되도록 설계해야 합니다.

# 작업 지시
키오스크 클라이언트 내부의 템플릿 파싱, 상태 관리, 하드웨어 제어, 오프라인 동기화 메커니즘을 상세히 설계하십시오.

# 핵심 설계 요구사항
1. 템플릿 파싱 및 렌더링 엔진: 서버에서 수신한 JSON 템플릿 스키마를 파싱하여, 해당 기기의 해상도(15/24/32인치)에 맞게 동적으로 UI를 렌더링하고, 정의된 데이터셋을 Fetch하여 바인딩하는 클라이언트 사이드 흐름을 설계하십시오.
2. 하드웨어 추상화 계층 (HAL): 관리자가 서버에서 동적으로 추가/삭제하는 '하드웨어 드라이버 설정(실제 Bixolon 프린터 vs 교육용 시뮬레이터)'을 클라이언트가 수신하여, 실제 물리적 포트 제어 또는 가짜 응답 반환(Mocking)을 동적으로 스위칭하는 아키텍처를 설계하십시오.
3. 오프라인 퍼스트 및 동기화 에이전트: 네트워크가 단절된 상태에서도 키오스크가 로컬에 캐시된 템플릿으로 작동하고, 설문 응답이나 로그 데이터를 로컬 DB(SQLite)에 큐잉(Queuing)했다가, 네트워크 복원 시 백그라운드에서 자동으로 서버로 배치 전송(Batch Sync)하는 메커니즘을 설계하십시오.
4. 장애 복구 (Fail-Safe): 액션 체인 실행 중 하드웨어 오류(예: 프린터 용지 부족)가 발생했을 때, 전체 앱이 멈추지 않고 정의된 에러 정책(재시도, 건너뛰기, 모달 경고)에 따라 복구하는 흐름을 설계하십시오.

# 산출물 형식
- 클라이언트 내부 모듈 아키텍처 다이어그램
- 오프라인 동기화를 위한 로컬 DB 스키마 및 동기화 상태 머신(State Machine) 흐름도
- 하드웨어 드라이버 동적 로딩 및 실행 시퀀스 다이어그램


🏛️ [레벨 5 심층 설계 명세서] 키오스크 비즈니스 OS (Kiosk Business OS)
1. 절대적 멀티테넌시 및 보안 격리 (Absolute Multi-Tenancy)
목표: 테넌트 A의 데이터가 테넌트 B에게 노출되는 것을 물리적/논리적으로 100% 차단.
DB 레벨 격리 (PostgreSQL RLS - Row-Level Security):
단순 WHERE tenant_id = ? 쿼리 의존을 배제합니다. 데이터베이스 자체에 RLS 정책을 적용하여, 현재 세션의 app.current_tenant_id 변수와 일치하지 않는 행(Row)은 쿼리 결과에서 아예 제외되도록 강제합니다.
리스크 대응: 개발자가 실수로 tenant_id 필터링을 빼먹는 휴먼 에러를 원천 차단합니다.
미들웨어 레벨 격리 (Axum Tenant Context):
모든 API 요청은 subdomain (예: center-a.kiosk.com) 또는 JWT에서 tenant_id를 추출합니다.
추출된 tenant_id는 요청 컨텍스트(Request Context)에 주입되며, 이 컨텍스트를 거치지 않은 내부 로직은 실행되지 않도록 컴파일 타임에 검증합니다.
에셋(이미지/동영상) 격리:
클라우드 스토리지(S3 등) 사용 시, 버킷 내부에 /{tenant_id}/assets/... 경로로 물리적 폴더를 분리하거나, Presigned URL 생성 시 tenant_id를 검증 로직에 포함하여 무단 접근을 차단합니다.
2. 비즈니스 로직 엔진: 상태 머신 및 멱등성 (State Machine & Idempotency)
목표: Xibo의 단순 재생을 넘어, '커피 주문', '좌석 예매' 등 트랜잭션이 필요한 로직을 안정적으로 처리.
낙관적 동시성 제어 (Optimistic Concurrency Control):
여러 키오스크에서 동시에 마지막 좌석이나 재고를 요청할 때를 대비해, 데이터베이스 레코드에 version 컬럼을 두어 충돌을 감지하고 처리합니다.
액션 체인의 멱등성 (Idempotency) 보장:
시니어 사용자가 '결제하기' 버튼을 연타할 경우를 대비해, 각 액션 체인 실행 시 고유한 idempotency_key(세션ID + 타임스탬프 해시)를 생성합니다.
서버는 동일한 키로 들어온 중복 요청을 무시하고, 첫 번째 요청의 결과만 반환하여 이중 결제나 중복 주문을 원천 차단합니다.
전역 상태 스냅샷 (Global State Snapshot):
키오스크가 갑자기 전원이 끊기거나 크래시되더라도, Tauri 클라이언트 내부 SQLite에 cart, current_step 등의 상태를 3초마다 자동 저장(Snapshot)합니다. 재부팅 시 "이전 작업을 복원하시겠습니까?"를 물어보며 세션을 복구합니다.
3. 동적 하드웨어 추상화 및 페일세이프 (Dynamic HAL & Fail-Safe)
목표: 하드웨어 변경이나 고장이 키오스크 운영을 중단시키지 않도록 함.
드라이버 핫스왑 (Hot-Swappable Drivers):
관리자가 대시보드에서 'Bixolon 실제 드라이버'를 '교육용 시뮬레이션 드라이버'로 변경하면, 키오스크는 다음 Heartbeat(상태 보고) 주기(예: 30초) 내에 이 설정을 받아옵니다.
재부팅이나 앱 재배포 없이, 다음 인쇄 명령부터 시뮬레이션 모드로 자동 전환되어 교육 흐름이 유지됩니다.
하드웨어 타임아웃 및 폴백 (Timeout & Fallback):
WAIT_HARDWARE 액션(예: 카드 리더기 대기) 실행 시, 기본 30초 타임아웃을 설정합니다.
시간 내에 응답이 없거나 Serial Port 오류가 발생하면, 액션 체인에 정의된 onError 정책(예: SHOW_MODAL: "카드를 다시 넣어주세요" 또는SKIP`)을 즉시 실행하여 앱이 무한 로딩에 걸리는 것을 방지합니다.
4. 오프라인 퍼스트 및 지능형 동기화 (Offline-First & Intelligent Sync)
목표: 폐쇄형 로컬 클라우드 또는 네트워크 불안정 환경에서도 24시간 무정지 운영.
로컬 우선 렌더링 (Local-First Rendering):
키오스크는 템플릿 JSON과 필수 에셋(이미지, 폰트)을 로컬 SQLite 및 파일 시스템에 완전히 캐싱합니다. 네트워크가 끊겨도 캐시된 버전으로 즉시 렌더링합니다.
이벤트 소싱 기반 오프라인 큐 (Event Sourcing Queue):
설문 응답, 로그, 단순 상태 변경은 서버 API 호출 대신 로컬 SQLite의 pending_events 테이블에 우선 기록됩니다.
백그라운드 워커(Background Worker)가 네트워크 상태를 감지(navigator.onLine 또는 서버 Ping)하여 온라인이 되면, 큐에 쌓인 이벤트를 배치(Batch, 예: 50개씩)로 서버로 전송하고 성공 시 로컬에서 삭제합니다.
충돌 해결 전략 (Conflict Resolution):
키오스크 로컬 시간과 서버 시간 동기화 문제 방지를 위해, 모든 로컬 이벤트 생성 시 서버에서 발급받은 동기화 타임스탬프를 함께 기록하거나, 서버 시간을 기준으로 정렬합니다.
5. 자동화된 접근성 게이트키퍼 (Automated Accessibility Gatekeeper)
목표: 어떤 관리자가 템플릿을 만들더라도 시니어 사용 기준(WCAG)을 강제 준수.
컴파일 타임 검증 (Compile-Time Validation for Templates):
관리자가 [게시(Publish)] 버튼을 누르는 순간, 백엔드에서 템플릿 JSON 스키마를 파싱하여 다음 규칙을 자동 검사합니다. 하나라도 실패하면 게시 자체를 차단하고 오류 위치를 명시합니다.
규칙 1 (터치 타겟): 모든 Button, InteractiveCard 타입 컴포넌트의 계산된 최소 크기가 15인치 기준 64x64px 미만인지 검증.
규칙 2 (색상 대비): backgroundColor와 textColor의 명도 대비율(Contrast Ratio)을 계산하여 4.5:1 (WCAG AA) 미만인지 검증.
규칙 3 (TTS 필수): 상호작용 컴포넌트에 ttsLabel 속성이 비어있는지 검증.
규칙 4 (네비게이션): 모든 페이지에 '홈으로 돌아가기' 버튼이 존재하는지 검증.

⚠️ 총괄 PM의 핵심 리스크 매트릭스 (Risk Matrix)
리스크 시나리오
영향도
발생 확률
대응 전략 (Mitigation Strategy)
SQL 인젝션 (동적 데이터셋)
치명적
중
관리자가 Raw SQL을 직접 입력하지 못하게 하고, UI 기반의 '컬럼 선택 및 필터 조건 빌더'만 제공하여 파라미터화된 쿼리만 생성되도록 강제.
저사양 기기 메모리 부족 (OOM)
높음
높
32인치용 고해상도 이미지를 15인치 기기에서 요청할 경우, 백엔드에서 자동 리사이징(Downsampling)된 에셋 URL을 반환하도록 에셋 파이프라인 구축.
설문 데이터 개인정보 유출
치명적
낮
설문 응답 JSON 저장 시, 이름/연락처 등 PII(개인식별정보) 필드는 DB 저장 전 AES-256-GCM으로 암호화하거나, 수집 즉시 해싱(Hashing) 처리.
관리자의 실수로 인한 전체 기기 오류
높음
중
템플릿 버전 관리(v1.0, v1.1) 도입. 신규 배포 후 오류율(Heartbeat 실패)이 10%를 초과하면 자동으로 이전 안정 버전(v1.0)으로 롤백(Rollback)하는 자동화 스크립트 도입.
Tauri Android 지원 불안정성
중
중
핵심 무인 키오스크는 Windows/Linux(Tauri)로 고정. Android 태블릿 등 모바일 환경은 검증된 TWA(Trusted Web Activity) 또는 PWA 래퍼 앱으로 이원화하여 배포 리스크 분산.

🏛️ [마스터 명세서 v5.0] 키오스크 비즈니스 OS 핵심 3대 축
1️⃣ 축 1: 메타 템플릿 및 시각적 SQL 빌더 JSON 스키마 (The Brain)
목표: 에디터에서 드래그앤드롭으로 구성된 UI, 데이터 연동(시각적 SQL), 비즈니스 로직(액션 체인)을 하나의 완전한 JSON으로 직렬화하여 서버와 클라이언트가 공유하는 단일 진리 공급원(Single Source of Truth)을 정의합니다.


{
  "schemaVersion": "2.1",
  "metadata": {
    "templateId": "tpl_cafe_001",
    "tenantId": "tenant_seoul_center_a",
    "name": "시니어 카페 주문 키오스크",
    "targetDevices": ["15inch", "24inch", "32inch"],
    "accessibilityValidated": true
  },
  "globalState": {
    "initialValues": {
      "cart": [],
      "currentUser": null,
      "sessionTimeoutSec": 60
    }
  },
  "datasets": [
    {
      "id": "ds_menu_001",
      "name": "카페 메뉴 실시간 조회",
      "sourceType": "VISUAL_SQL", 
      "visualQuery": {
        "fromTable": "products",
        "joins": [
          { "table": "categories", "on": "products.category_id = categories.id", "type": "INNER" }
        ],
        "filters": [
          { "field": "products.is_active", "operator": "=", "value": true },
          { "field": "categories.tenant_id", "operator": "=", "value": "{{CURRENT_TENANT_ID}}" }
        ],
        "orderBy": { "field": "products.display_order", "direction": "ASC" }
      },
      "schema": [
        { "key": "id", "type": "string" },
        { "key": "name", "type": "string" },
        { "key": "price", "type": "number" },
        { "key": "image_url", "type": "string" }
      ]
    }
  ],
  "pages": [
    {
      "id": "page_main",
      "name": "메인 주문 화면",
      "components": [
        {
          "id": "comp_grid_01",
          "type": "ProductGrid",
          "position": { "x": "5%", "y": "15%", "w": "60%", "h": "70%" },
          "props": {
            "columns": 3,
            "ttsLabel": "원하시는 메뉴를 선택해 주세요",
            "itemSize": "large"
          },
          "datasetBinding": {
            "datasetId": "ds_menu_001",
            "fieldMapping": {
              "title": "name",
              "price": "price",
              "image": "image_url"
            }
          },
          "actionChainId": "chain_add_to_cart"
        }
      ]
    }
  ],
  "actionChains": {
    "chain_add_to_cart": {
      "nodes": [
        {
          "id": "node_1",
          "type": "UPDATE_STATE",
          "config": { "stateKey": "cart", "operation": "PUSH", "value": "{{SELECTED_ITEM}}" }
        },
        {
          "id": "node_2",
          "type": "PLAY_SOUND",
          "config": { "soundId": "click_confirm" }
        },
        {
          "id": "node_3",
          "type": "NAVIGATE",
          "config": { "targetPageId": "page_cart_review" }
        }
      ],
      "onError": { "policy": "SHOW_MODAL", "config": { "modalId": "modal_error_default" } }
    }
  }
}

PM 해설 (시각적 SQL의 힘): sourceType: "VISUAL_SQL"과 visualQuery 블록이 핵심입니다. 관리자는 Raw SQL을 짜지 않고, UI에서 'products' 테이블과 'categories' 테이블을 선으로 연결하고, 필터 조건을 드롭다운으로 선택합니다. 백엔드는 이 JSON을 파싱하여 SQL 인젝션이 불가능한 파라미터화된 안전한 쿼리로 동적 컴파일합니다.
2️⃣ 축 2: 철벽 멀티테넌시 보안 (RLS + Axum Middleware)
목표: 개발자의 실수나 악의적인 API 호출로도 테넌트 간 데이터 누수가 0.0001%도 발생하지 않도록, 데이터베이스 엔진 레벨에서 격리를 강제합니다.
2.1 논리적 흐름 (Logical Flow)
Request Entry: 키오스크 또는 관리자가 Authorization: Bearer <JWT> 헤더와 함께 API 요청.
Axum Middleware (Tenant Extractor): JWT를 검증하여 tenant_id와 role을 추출.
Context Injection: 추출된 tenant_id를 Axum의 Request Extensions에 주입.
DB Connection Pool Interceptor: SQLx가 쿼리를 실행하기 직전, PostgreSQL 세션에 SET LOCAL app.current_tenant_id = '추출된_tenant_id' 명령을 자동 주입.
PostgreSQL RLS Enforcement: 데이터베이스가 쿼리를 실행할 때, 모든 테이블에 걸린 RLS 정책이 current_setting('app.current_tenant_id') 값을 기준으로 행(Row)을 자동으로 필터링.
2.2 PostgreSQL RLS 정책 명세 (실제 적용 예시)
-- 1. RLS 활성화
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- 2. 조회(SELECT) 정책: 자신의 테넌트 ID와 일치하는 데이터만 조회 가능
CREATE POLICY tenant_isolation_select ON templates
FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 3. 삽입(INSERT) 정책: 삽입하는 데이터의 tenant_id가 현재 세션의 tenant_id와 일치해야 함
CREATE POLICY tenant_isolation_insert ON templates
FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4. 슈퍼관리자 예외 정책 (옵션): 슈퍼관리자는 모든 데이터 조회 가능
CREATE POLICY super_admin_bypass ON templates
FOR ALL USING (current_setting('app.current_role')::text = 'SUPER_ADMIN');
PM 해설: 이 구조가 완성되면, 백엔드 개발자가 WHERE tenant_id = ?를 실수로 빼먹어도 데이터베이스 엔진이 자동으로 차단합니다. 이것이 진정한 Zero-Trust 아키텍처입니다.

3️⃣ 축 3: 오프라인 퍼스트 동기화 및 상태 머신 (The Engine)
목표: 네트워크가 끊겨도 키오스크는 죽지 않으며, 로컬에서 모든 비즈니스 로직을 수행하고 네트워크 복원 시 데이터를 유실 없이 서버로 전송합니다.
3.1 로컬 SQLite 스키마 (Tauri Client 내부)
-- 1. 오프라인 이벤트 큐 (설문 응답, 로그, 상태 변경 등)
CREATE TABLE pending_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,          -- 예: 'SURVEY_SUBMIT', 'HEARTBEAT'
    payload TEXT NOT NULL,             -- JSON 문자열
    idempotency_key TEXT UNIQUE,       -- 중복 전송 방지를 위한 해시 키
    retry_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'PENDING'      -- PENDING, SYNCING, FAILED
);

-- 2. 전역 상태 스냅샷 (크래시 복구용)
CREATE TABLE state_snapshots (
    session_id TEXT PRIMARY KEY,
    state_data TEXT NOT NULL,          -- JSON (장바구니, 현재 페이지 등)
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 로컬 캐시된 템플릿 및 에셋 메타데이터
CREATE TABLE cached_templates (
    template_id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    json_schema TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true
);
3.2 동기화 상태 머신 (Sync State Machine)
키오스크 내부의 백그라운드 워커(Background Worker)는 다음 상태 전이(State Transition)를 따릅니다.
IDLE (대기): 네트워크 상태를 10초마다 Ping으로 확인.
ONLINE_DETECTED (온라인 감지): pending_events 테이블에서 status = 'PENDING'이고 retry_count < 5인 레코드를 최대 50개씩 Batch 조회.
SYNCING (동기화 중): 서버의 /api/v1/sync/batch API로 전송. 헤더에 Idempotency-Key 포함.
SUCCESS (성공): 서버가 200 OK를 반환하면, 로컬 SQLite에서 해당 레코드들을 DELETE. 상태를 IDLE로 복귀.
FAILED (실패 및 지수 백오프): 서버 오류(5xx) 또는 타임아웃 발생 시, retry_count를 1 증가시키고, 다음 재시도 간격을 지수적으로 늘림 (1분 → 5분 → 15분). 5회 실패 시 FAILED 상태로 영구 격리하여 관리자 알림 발생.
PM 해설: 이 구조 덕분에 인터넷이 1시간 끊겨도 시니어는 설문을 작성하고 교육을 완료할 수 있습니다. 데이터는 로컬에 안전하게 쌓여있다가, 인터넷이 돌아오는 순간 자동으로 서버로 올라갑니다. 무정지 운영(24/7 Uptime)을 보장하는 핵심 메커니즘입니다.

