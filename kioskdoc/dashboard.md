# 관할 대시보드 구현 및 검증 기록 (2026-09-23)

## 범위와 상태

현재 로그인한 테넌트 안에서 조직 관할, 역할별 화면, 기간·시간대별 이용량,
기기별 오류 알림과 이력을 제공한다. 테넌트는 키오스크 업체·운영 주체를 담는 경계이며,
시·군·구와 복지관·경로당 등은 테넌트 내부 조직으로 관리한다.
문자 업체·수신자 정책은 미정이므로 SMS 연동 및 발송은 이번 범위에서 제외했다.

| 역할 | 조회 범위 | 주요 화면 |
|---|---|---|
| SUPER_ADMIN / TENANT_ADMIN | 현재 테넌트 전체 또는 선택 조직의 하위 전체 | 센터 비교, 기기 상태, 이용량, 설문, 오류 |
| CITY_MANAGER | 배정된 시·군 및 하위 조직 | 관할 센터 비교, 이용량, 오류 |
| DISTRICT_MANAGER / GROUP_MANAGER | 배정 조직 및 하위 조직 | 관할 운영 현황 |
| CENTER_MANAGER | 배정 센터 | 센터 기기, 이용·설문, 오류 |
| INSTRUCTOR | 배정 조직 | 교육 이용·완료·설문, 오류 읽기 |

화면에 보이는 필터 목록과 실제 통계에 동일한 관할 검증을 적용한다.
관할 미배정 계정은 배정 안내와 빈 범위를 받는다. 관할 밖 org_id를 직접 요청하면 403이다.
강사 개인 수업과 이용 세션을 연결하는 모델은 아직 없으므로, 강사 화면은 배정 조직의 교육 현황이다.
복지관·경로당은 현재 조직 모델의 CENTER 단위를 사용하며 시설 종류별 별도 분류는 추가하지 않았다.

## 집계 기준

- 기간: YYYY-MM-DD, 양 끝 날짜 포함, 기본 최근 7일, 최대 90일, 미래 날짜 조회 불가.
- 날짜와 시간대: Asia/Seoul. UTC로 저장된 발생 시각을 한국시간으로 변환한다.
- 기간 이용 시작: APP_START 건수. 완료: APP_COMPLETE 건수. 완료율은 두 이벤트 건수의 비율이다.
  시작이 조회 기간 밖인 세션의 완료가 포함되면 비율이 100%를 넘을 수 있으므로 세션 코호트 완료율과 구분한다.
- 시간대별 이용량: 선택 기간의 0–23시 이용 시작 합계. 동시 이용자·대기 인원 지표가 아니다.
- 설문: 1–5점 숫자/문자열, answer/value/score/rating/responses와 배열을 처리한다.
  😊/😐/😞는 각각 5/3/1점으로 환산하며 그 밖의 응답은 점수 평균에서 제외한다.
- 데이터가 없는 날짜는 0으로 표시한다. 기존 20,000행 절단을 새 API에서는 사용하지 않는다.
  DB에서 기간·관할 필터 후 그룹 집계한다.
- 기기 응답: 승인/온라인 상태이며 최근 5분 이내 heartbeat가 있을 때 응답 중으로 집계한다.
- 과거 이벤트의 조직 귀속은 현재 기기 배치 기준이다. 기기 이동 시 과거 통계도 현재 배치를 따른다.
  이동 당시 조직 기준 통계가 필요하면 이벤트에 조직 스냅샷을 추가해야 한다.

## 오류 알림

대시보드와 독립적인 서버 워커가 30초마다 규칙을 평가한다. 화면도 30초마다 갱신하므로
수집된 이벤트가 표시되기까지 두 주기의 지연이 발생할 수 있다.

- 동일 기기 + 동일 규칙에 대해 지정 시간 내 오류가 임계치 이상이면 OPEN.
- 담당자 확인 시 ACKNOWLEDGED. 동일 장애를 계속 새 알림으로 만들지 않는다.
- 오류가 시간 범위에서 빠져 임계치 아래가 되면 RESOLVED. 이후 다시 임계치에 도달하면 새 이력 생성.
- 규칙 중지는 기존 이력을 보존하며 열린 이력을 해제한다.
- 비관리자 전체 테넌트 규칙 생성 금지. 시·군·구·센터 운영자는 자신의 관할 조직을 지정해야 한다.
- 강사는 읽기만 가능하다. 규칙 생성·중지·알림 확인은 감사 로그에 기록한다.
- 날짜 필터는 이용 통계에 적용한다. 알림 탭은 현재 관할의 최근 이력 최대 100건을 표시한다.

## 기기 이벤트 수집과 교육 완료

기존 키오스크가 관리자 JWT 경로로 전송하던 이벤트와 heartbeat를 기기 비밀키 인증 경로에 연결했다.
미승인 또는 잘못된 키는 403. 테넌트·기기 ID는 서버에서 인증된 기기 행으로 결정한다.

- 기기 이벤트의 발생 시각을 보존한다. 업로드 시각으로 점심 피크가 뒤틀리지 않는다.
- 배치 최대 50건, 이벤트 payload 최대 32KiB, 발생 시각은 최근 7일~미래 5분 범위.
- 기기 + 이벤트 UUID 단위 수신 기록과 이벤트 삽입을 같은 트랜잭션으로 처리해 재전송 중복을 막는다.
- 브라우저 큐 최대 10,000건, 7일 만료, 재시도 간격 60/300/900초, 최대 5회.
  5회 실패한 항목은 7일 만료까지 로컬에 보관하며 자동 재전송 대상에서 제외한다.
- 전송 중 새로 쌓인 이벤트를 보존하고 동시 flush를 합친다.
- 승인된 키오스크에서 첫 사용자 조작 시 APP_START. 홈 복귀·무조작 종료는 완료로 간주하지 않는다.
- 에디터 → 화면 목록 → `교육·이용 완료 화면`을 지정하면
  `customExtensions.analytics.completionPageIds`로 저장·복원한다.
  이용 중 지정 화면에 도달할 때 세션당 한 번 APP_COMPLETE를 기록한다.
- 실제 실행 실패를 PAPER_JAM / HARDWARE_TIMEOUT / DRIVER_ERROR / API_ERROR / ACTION_ERROR로 기록한다.
  오류 메시지 원문은 통계 이벤트에 넣지 않는다.

## API

| 경로 | 기능 |
|---|---|
| GET /api/v1/analytics/dashboard?org_id=...&from=...&to=... | 관할 옵션·기간 집계·센터 비교 |
| GET /api/v1/analytics/alerts?org_id=... | 관할 규칙·이력·관리 가능 여부 |
| POST /api/v1/analytics/alert-rules | name, error_type, threshold, window_min, org_unit_id |
| DELETE /api/v1/analytics/alert-rules/:id | 규칙 사용 중지, 이력 보존 |
| POST /api/v1/analytics/alerts/:id/ack | 담당자 확인 |
| POST /api/v1/public/devices/:uuid/events | device_key와 events 배치 |
| POST /api/v1/public/devices/:uuid/heartbeat | device_key와 선택적 storage_percent |

대시보드 API의 현재 구현은 `crates/kiosk_server/src/dashboard.rs`이다.
`db.rs`의 예전 dashboard_detail/dashboard_stats는 기존 내부 호출·테스트용 코드이며 새 화면에서는 호출하지 않는다.
SQLite는 시작 시 스키마를 보완하고, PostgreSQL에는 008_dashboard_alert_history.sql을 추가했다.

## 재현 가능한 검증

```bash
cargo test --workspace
node --test scripts/test-kiosk-telemetry.cjs
npm run build --prefix admin_editor
npm run build --prefix kiosk_app
```

브라우저 검증은 개발 DB와 분리된 인메모리 서버를 사용한다.

```bash
# 터미널 1: 검증용 서버 (127.0.0.1:18080)
cargo run -p kiosk_server --example dashboard_preview
# 터미널 2: 관리자 Vite 서버 (이미 5173이 실행 중이면 생략)
npm run dev --prefix admin_editor -- --host 0.0.0.0
# 터미널 3: Playwright 설치 경로를 지정해 실행
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/test-dashboard-browser.cjs
```

검증 서버는 자체 메모리 DB에만 자료를 만든다. 위 브라우저 스크립트는 /api 요청을 18080으로 전달하며
역할별 화면, 센터 필터, 관할 밖 403, 알림 등록·확인·중지, 390px 모바일 가로 넘침을 확인한다.
스크린샷은 artifacts/dashboard에 저장한다. Chromium과 운영체제용 브라우저 라이브러리가 필요하다.

이번 환경에서 확인: Rust 77개 테스트, 브라우저 큐/세션 4개 테스트, 관리자·키오스크 빌드,
실제 개발 서버 로그인/대시보드, 격리 데이터로 역할별 데스크톱·모바일 화면.
PostgreSQL 실서버 통합 실행과 Tauri 네이티브 앱 실행은 이번 검증에 포함되지 않았다.
