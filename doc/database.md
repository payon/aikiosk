4. database.md (데이터베이스 설계)
4.1. 논리 데이터 모델 (Logical Data Model)
User: 플랫폼 사용자 (관리자, 일반 사용자).
Application: 통합 플랫폼에 등록된 개별 앱 정보.
Role_Permission: 사용자 역할과 앱별 접근 권한 매핑.
Layout_Config: 디바이스 유형별 그리드 설정 Overrides (선택적 확장).
4.2. 물리 데이터 모델 (Prisma Schema 예시)
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  permissions   UserAppPermission[]
}

model Application {
  id            String    @id @default(uuid())
  name          String    // 예: "러스트 라이브러리"
  slug          String    @unique // 예: "library"
  targetUrl     String    // 예: "https://library.rustkorea.cloud"
  iconUrl       String    // CDN 경로
  description   String?   
  isActive      Boolean   @default(true)
  displayOrder  Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  permissions   UserAppPermission[]
}

model UserAppPermission {
  id            String    @id @default(uuid())
  userId        String
  appId         String
  accessLevel   AccessLevel @default(VIEW)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  app           Application @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@unique([userId, appId])
}

enum Role {
  ADMIN
  USER
}

enum AccessLevel {
  VIEW
  ADMIN
}
