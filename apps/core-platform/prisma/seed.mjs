// DB 시드: node prisma/seed.mjs (DATABASE_URL 필요)
// 데모 관리자: admin@rustkorea.cloud / Admin123!
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const domain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "rustkorea.cloud";
  await prisma.platformSetting.upsert({
    where: { platformDomain: domain },
    update: {},
    create: {
      platformDomain: domain,
      platformName: "러스트코리아",
      primaryColor: "#C2410C",
      logoUrl: "/logo.svg",
      allowedDomains: [domain]
    }
  });

  const passwordHash = await bcrypt.hash("Admin123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@rustkorea.cloud" },
    update: {},
    create: { email: "admin@rustkorea.cloud", passwordHash, role: "ADMIN" }
  });

  const apps = [
    { name: "러스트 라이브러리", slug: "library", targetUrl: `https://library.${domain}`, iconUrl: "/icons/library.svg", description: "디지털 에셋 라이브러리", displayOrder: 0 },
    { name: "AI Platform", slug: "aiplatform", targetUrl: `https://aiplatform.${domain}`, iconUrl: "/icons/ai.svg", description: "AI 솔루션 허브", displayOrder: 1 },
    { name: "헬스케어", slug: "healthcare", targetUrl: `https://healthcare.${domain}`, iconUrl: "/icons/health.svg", description: "헬스케어 대시보드", displayOrder: 2 }
  ];
  for (const a of apps) {
    const row = await prisma.application.upsert({
      where: { slug: a.slug },
      update: { targetUrl: a.targetUrl, isActive: true },
      create: a
    });
    await prisma.userAppPermission.upsert({
      where: { userId_appId: { userId: admin.id, appId: row.id } },
      update: {},
      create: { userId: admin.id, appId: row.id, accessLevel: "ADMIN" }
    });
  }
  console.log("seed ok:", domain);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
