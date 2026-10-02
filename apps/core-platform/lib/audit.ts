export async function writeAuditLog(entry: {
  actorId: string;
  action: string;
  target?: string;
  result: "success" | "fail";
}) {
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.auditLog.create({ data: entry });
  } catch {
    console.log("[audit]", entry.action, entry.actorId, entry.target ?? "", entry.result);
  }
}
