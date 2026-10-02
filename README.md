# RustKorea Unified Platform

단일 도메인 통합 앱 허브. 런처 1개 포트만 공개하고 어드민·API·서브앱은 내부망으로만 통신한다.

## 구조

| 앱 | 경로 | 포트 | 설명 |
|---|---|---|---|
| launcher | `apps/core-platform` | 4500 (공개) | 런처·SSO 셸·rewrite 게이트웨이 |
| api-server | `apps/api-server` | 4501 (내부) | Express API + Prisma |
| admin | `apps/admin` | 4502 (내부, `/admin`) | 관리자 대시보드 |
| library/aiplatform/healthcare | `apps/*` | 4511~4513 (내부) | 서브앱 (`basePath: /apps/<slug>`) |

## 개발 실행

```bash
cd apps/api-server && npm i && PORT=4501 node server.js &
cd apps/library && npm i && npm run build && PORT=4511 npm run start &
cd apps/aiplatform && npm i && npm run build && PORT=4512 npm run start &
cd apps/healthcare && npm i && npm run build && PORT=4513 npm run start &
cd apps/core-platform && npm i && npm run build && PORT=4500 npm run start &
cd apps/admin && npm i && npm run build && PORT=4502 npm run start &
```

- 런처: `http://HOST:4500/` / 어드민: `http://HOST:4500/admin`
- 계정: `admin@rustkorea.cloud` / `Admin123!` (일반 `user@rustkorea.cloud` / `User123!`)
- 빌드는 절대 파이프로 자르지 말 것 (`| head` 시 SIGPIPE로 중단되어 `.next/BUILD_ID` 누락)

## 운영 배포 (Docker)

```bash
export DATABASE_URL="postgresql://..." SESSION_SECRET="..." PLATFORM_DOMAIN="rustkorea.cloud"
docker compose up -d --build
# DB 최초 1회: docker compose exec backend npx prisma migrate deploy && npm run seed
```

- 외부 공개 포트는 4500 하나. 4501/4502/4511~4513은 `expose` 내부 전용.
- 운영에서는 `LOCAL_APPS=false`, `ALLOW_LOCAL_APPS=false` (compose 기본값).
- 외부 실서버 연동: 어드민에서 targetUrl 등록. 상대가 `basePath` 없으면 수정 모달의 루트형/직접 이동 옵션 사용.
