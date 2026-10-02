# 데이터베이스 스키마 설계 (PostgreSQL)

## 1. 핵심 테이블
- `tenants`: id, subdomain, name, plan, created_at
- `users`: id, tenant_id, email, password_hash, role (SUPER_ADMIN, TENANT_ADMIN, STAFF), status
- `devices`: id, tenant_id, hardware_uuid, mac_address, screen_size (15|21|32), status (ONLINE|OFFLINE), last_heartbeat
- `templates`: id, tenant_id, name, base_template_id (마스터 템플릿 참조), json_layout, version, is_active
- `template_assets`: id, tenant_id, template_id, asset_type (image|video|font), url, local_cache_path
- `hardware_logs`: id, tenant_id, device_id, action_type (PRINT|PAY_SIM), payload, created_at

## 2. 멀티테넌시 보장
- 모든 비즈니스 테이블에 `tenant_id` NOT NULL 인덱스 적용.
- PostgreSQL RLS(Row-Level Security) 정책 활성화: `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`

# [프롬프트 목표] 멀티테넌시 격리, 설문, 통계 데이터를 포함한 PostgreSQL/SQLite 스키마를 정의한다.

## 1. 핵심 테이블 정의
- `tenants`: id, subdomain, deployment_mode (CLOUD|LOCAL), created_at
- `users`: id, tenant_id, role (SUPER_ADMIN, TENANT_ADMIN, GROUP_MANAGER), password_hash
- `devices`: id, tenant_id, hardware_uuid, screen_size, status, last_heartbeat, local_storage_usage_percent
- `templates`: id, tenant_id, name, json_layout, schema_version, is_active
- `surveys`: id, tenant_id, template_id, questions (JSONB: [{type: "emoji", question: "오늘 교육이 도움이 되셨나요?"}])
- `analytics_events`: id, tenant_id, device_id, session_id, event_type (APP_START, APP_COMPLETE, SURVEY_SUBMIT, ERROR), payload (JSONB), created_at
- `audit_logs`: id, tenant_id, user_id, action, target_id, ip_address, created_at (RBAC 및 변경 이력 추적용)

## 2. 인덱싱 및 보안 전략
- 모든 테이블에 `tenant_id` 인덱스 적용.
- PostgreSQL RLS(Row-Level Security) 활성화.
- `analytics_events` 테이블은 시간 기반 파티셔닝(Time-series partitioning) 적용하여 대용량 로그 조회 성능 보장.
- `payload` 내 개인정보(이름, 연락처)는 AES-256 암호화 또는 해싱 처리.

- `tenant_datasets`: id, tenant_id, name, schema_definition (JSONB), source_type (SQL|API|STATIC), connection_params
- `tenant_global_states`: id, tenant_id, state_key (예: 'cart', 'user_session'), initial_value (JSONB)
- `template_action_chains`: id, template_id, trigger_component_id, action_nodes (JSONB: 순차적 실행 노드 배열)