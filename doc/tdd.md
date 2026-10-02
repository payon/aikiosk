9. tdd.md (테스트 전략)
9.1. 단위 테스트 (Jest + React Testing Library)
middleware.ts: /apps/library/detail 요청이 올바른 targetUrl로 rewrite 되는지 검증.
<AppGrid>: 전달받은 apps 배열의 길이에 따라 정확한 수의 카드가 렌더링되는지 검증.
useDeviceType: window.innerWidth 변경 시 올바른 디바이스 타입을 반환하는지 검증.
9.2. 통합 테스트 (Integration)
관리자 앱 등록 API 호출 → DB 저장 확인 → GET /api/apps 호출 시 해당 앱이 목록에 포함되는지 검증.
9.3. E2E 테스트 (Playwright)
시나리오 1 (다중 디바이스): Playwright의 deviceDescriptors를 사용하여 iPhone 12, iPad Pro, Desktop 1920x1080, Kiosk 1080x1920에서 앱 런처 그리드가 각각 2열, 3열, 4열, 3열로 올바르게 렌더링되는지 스크린샷 비교 테스트.
시나리오 2 (SSO 흐름): 코어 플랫폼 로그인 → /apps/aiplatform 이동 → 서브 앱에서 로그인 상태가 유지되어 있는지 DOM 요소 검증.
