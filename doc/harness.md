10. harness.md (CI/CD 및 운영 해니스)
10.1. CI 파이프라인 (.github/workflows/ci.yml)
name: CI Pipeline
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run build
10.2. CD 및 배포 전략
Core Platform: Vercel (Edge Network 활용으로 미들웨어 지연 최소화) 또는 자체 Docker + Kubernetes (데이터 주권 요구 시).
Sub-Apps: 기존 배포 파이프라인 유지. 단, 배포 후 코어 플랫폼의 revalidatePath('/api/apps')를 트리거하여 캐시 갱신.
키오스크 배포: PWA 매니페스트를 활용하여 키오스크 브라우저의 "홈 화면에 추가" 또는 Kiosk Mode 실행 스크립트 제공.
10.3. 모니터링 및 로깅
프론트엔드: Sentry 연동 (JS 에러, 성능 병목, 클라이언트 측 라우팅 오류 추적).
미들웨어: Vercel Analytics 또는 자체 Prometheus를 통한 /apps/[slug] 경로별 요청 수 및 응답 시간 모니터링.