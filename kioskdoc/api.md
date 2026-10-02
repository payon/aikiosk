# API 명세서 (RESTful / JSON)

## 1. 인증 및 권한 (Auth)
- `POST /api/v1/auth/login`: JWT 발급 (Payload에 `tenant_id`, `role` 포함)
- `POST /api/v1/auth/refresh`: 토큰 갱신

## 2. 템플릿 관리 (Template)
- `GET /api/v1/templates`: 테넌트별 템플릿 목록 조회
- `POST /api/v1/templates`: 새 템플릿 생성 (JSON 레이아웃 수신)
- `PUT /api/v1/templates/{id}`: 드래그앤드롭으로 수정된 JSON 레이아웃 업데이트
- `POST /api/v1/templates/{id}/publish`: 특정 기기에 배포 명령 발행 (MQTT/WebSocket 트리거)

## 3. 기기 관리 (Device)
- `POST /api/v1/devices/register`: hardware_uuid, screen_size로 등록 요청 (수퍼관리자 승인 대기)
- `POST /api/v1/devices/{uuid}/heartbeat`: 30초 주기 상태 보고
- `POST /api/v1/devices/{uuid}/simulate`: 교육용 결제/프린트 시뮬레이션 트리거

## 4. 하드웨어 시뮬레이션
- `POST /api/v1/hardware/print`: { device_id, text_data, bixolon_command } → 서버가 로그 기록 후 기기에게 Tauri Command 실행 신호 전송.

# [프롬프트 목표] 프론트엔드와 클라이언트가 통신할 RESTful/WebSocket API 엔드포인트를 정의한다.

## 1. 템플릿 및 하드웨어 관리
- `GET /api/v1/templates`: 테넌트별 템플릿 목록 (페이지네이션)
- `POST /api/v1/hardware/drivers`: 새 하드웨어 드라이버 등록 (슈퍼관리자 전용)

## 2. 앱 수행 및 설문 수집 (Kiosk → Server)
- `POST /api/v1/analytics/events`: 앱 수행 이벤트(시작, 완료, 오류) 배치 전송.
- `POST /api/v1/analytics/surveys`: 설문 응답 제출. 
  - *Request*: `{ "session_id": "uuid", "device_id": "uuid", "responses": [{"question_id": 1, "answer": "5"}] }`
  - *Validation*: 스키마 검증 실패 시 400 반환, 성공 시 202 Accepted (비동기 처리).

## 3. 통계 및 시각화 (Server → Admin)
- `GET /api/v1/analytics/dashboard`: 기간, 센터, 기기 필터링된 집계 데이터 반환.
- *Response*: `{ "completion_rate": 0.85, "survey_satisfaction_avg": 4.2, "error_count_by_type": {...} }`

- `POST /api/v1/datasets/resolve`: 클라이언트가 데이터셋 ID를 보내면, 백엔드가 동적으로 SQL을 실행하거나 외부 API를 프록시하여 데이터를 반환하는 메타 API.
- `POST /api/v1/actions/execute`: 복잡한 비즈니스 로직(예: 재고 차감 + 결제 승인 + 포인트 적립)을 트랜잭션으로 처리하는 서버 측 액션 실행기.