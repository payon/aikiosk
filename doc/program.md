📁 7. program.md (개발 로드맵)
총 기간: 5주 (상업적 출시 및 안정성 확보 우선)
Week 1: 코어 인프라 및 DB 구축
Next.js App Router 프로젝트 초기화, Prisma 스키마 적용 및 PostgreSQL 연동.
미들웨어(middleware.ts) 기본 Rewrite 로직 프로토타이핑.
Week 2: 반응형 UI/UX 및 셸 레이아웃 구현
uiux.md에 명시된 브레이크포인트 및 4:5 그리드 시스템 Tailwind CSS로 구현.
<ResponsiveSidebar>, <AppGrid>, 모바일 하단 내비게이션 컴포넌트 개발.
Week 3: 서브 앱 통합 및 SSO 연동
기존 3개 앱에 basePath 또는 프록시 헤더 수용 로직 적용.
코어 플랫폼의 인증 쿠키를 서브 앱이 읽을 수 있도록 Shared Cookie 도메인 설정 검증.
Week 4: 관리자 대시보드 및 동적 로딩 완성
앱 CRUD 관리자 화면 개발.
Next.js revalidatePath 또는 서버 액션을 활용한 실시간 아이콘 갱신 로직 구현.
Week 5: 다중 디바이스 테스트, 최적화 및 배포
실제 21~55인치 키오스크 에뮬레이션 및 실기기 테스트.
Lighthouse 성능 점수 90점 이상 달성, Sentry 모니터링 연동, 상용 배포.