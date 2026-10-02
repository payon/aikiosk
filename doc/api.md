5. api.md (API 명세서)
모든 API는 Next.js Route Handlers (app/api/.../route.ts)로 구현되며, JWT 또는 세션 쿠키로 인증합니다.
5.1. GET /api/apps
설명: 현재 사용자가 접근 가능한 활성 앱 목록 조회.
Response:
  {
    "success": true,
    "data": [
      {
        "id": "uuid-1",
        "name": "AI Platform",
        "slug": "aiplatform",
        "targetUrl": "https://aiplatform.rustkorea.cloud",
        "iconUrl": "/icons/ai.svg",
        "displayOrder": 1
      }
    ]
  }
  5.2. POST /api/admin/apps
설명: 새 앱 등록 (ADMIN 권한 필요).
Request Body:
  {
    "name": "헬스케어 대시보드",
    "slug": "healthcare",
    "targetUrl": "https://healthcare.rustkorea.cloud",
    "iconUrl": "/icons/health.svg",
    "displayOrder": 2,
    "isActive": true
  }
  5.3. GET /api/auth/me
설명: 현재 세션 사용자 정보 및 권한 조회 (SSO 상태 확인용).
