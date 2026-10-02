# 보안 요구사항 및 정책

## 1. 멀티테넌시 격리
- 모든 DB 쿼리는 ORM(SQLx) 수준에서 `tenant_id` 필터링을 강제.
- Super Admin은 모든 테넌트 조회 가능, Tenant Admin은 자신의 `tenant_id`만 조회 가능하도록 RBAC 미들웨어 구현.

## 2. 기기 인증 (Device Trust)
- 키오스크 최초 실행 시 TPM 또는 메인보드 시리얼/MAC 주소를 해싱하여 `hardware_uuid` 생성.
- 수퍼관리자 대시보드에서 해당 UUID를 명시적으로 '승인'해야만 템플릿 다운로드 및 API 호출 허용.

## 3. 데이터 보호
- 비밀번호: Argon2id 해싱 알고리즘 사용.
- 통신: 모든 API는 HTTPS(WSS)만 허용.
- 로컬 저장소: Tauri 앱 내 민감한 설정값은 OS 키체인(Keychain/Windows Credential Manager)에 저장.

# [프롬프트 목표] 멀티테넌시 격리, 데이터 보호, 접근 통제를 정의한다.

## 1. 데이터 보안 (PII Protection)
- 설문 응답에 이름, 생년월일 등 식별 정보가 포함될 경우, DB 저장 전 AES-256-GCM 암호화 또는 단방향 해싱 처리.
- 통계 집계 시에는 반드시 익명화(Aggregated & Anonymized)된 데이터만 관리자 대시보드에 노출.

## 2. RBAC 및 감사 로그 (Audit Logging)
- 템플릿 수정, 하드웨어 드라이버 추가/삭제, 게시 승인 등 모든 변경 사항은 `audit_logs` 테이블에 `user_id`, `action`, `timestamp`, `ip`와 함께 기록.
- 슈퍼관리자는 모든 로그 조회 가능, 센터장은 자신의 테넌트 로그만 조회 가능.

## 3. 기기 신뢰성 (Device Trust)
- 키오스크 최초 부팅 시 생성된 `hardware_uuid`가 관리자 대시보드에서 명시적으로 '승인'되지 않으면, 템플릿 다운로드 및 설문 업로드 API를 403 Forbidden으로 차단.

- **데이터셋 접근 통제**: 테넌트 A가 등록한 SQL 데이터셋이 테넌트 B의 DB에 접근하지 못하도록, 백엔드 Dynamic Resolver에서 `tenant_id` 기반의 DB 커넥션 풀을 엄격히 격리.
- **PCI-DSS 준수 시뮬레이션**: 카드 결제 시뮬레이션 시 실제 카드 번호가 로그나 로컬 스토어에 남지 않도록 마스킹(Masking) 및 휘발성 메모리 처리.