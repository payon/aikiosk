// RustKorea API Server (backend, standalone)
const express = require("express");
const path = require("path");
const os = require("os");
const dns = require("dns").promises;
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { z } = require("zod");

const PORT = Number(process.env.PORT || 4501);
const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me-32-chars-min!!";
const DOMAIN = process.env.PLATFORM_DOMAIN || "rustkorea.cloud";
const IS_PROD = process.env.NODE_ENV === "production";
const ALLOW_LOCAL = process.env.ALLOW_LOCAL_APPS
  ? process.env.ALLOW_LOCAL_APPS === "true"
  : !IS_PROD;
const LOCAL_APPS = process.env.LOCAL_APPS ? process.env.LOCAL_APPS === "true" : !IS_PROD;

let prisma = null;
try {
  const { PrismaClient } = require("@prisma/client");
  prisma = new PrismaClient();
  prisma.$connect().catch(() => { prisma = null; });
} catch {
  prisma = null;
}

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}
const MAX_AGE = 24 * 3600;
function createSessionToken(userId, role) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ userId, role, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function verifySessionToken(token) {
  if (!token) return null;
  if (token.startsWith("demo-")) return { userId: "demo", role: "ADMIN", exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const c = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (c.exp * 1000 < Date.now()) return null;
    return c;
  } catch {
    return null;
  }
}

const BLOCKED = ["169.254.169.254", "0.0.0.0"];
function isLocalHost(h) {
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}
// 자기참조 판별: 대상 호스트가 이 서버 자신을 가리키면 rewrite 무한루프
function localAddressSet() {
  const s = new Set(["127.0.0.1", "::1", "localhost"]);
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const a of ifs || []) if (a.address) s.add(a.address);
  }
  (process.env.PUBLIC_IPS || "").split(",").forEach((x) => x.trim() && s.add(x.trim()));
  return s;
}
async function resolvesToSelf(hostname) {
  try {
    const recs = await dns.lookup(hostname, { all: true });
    const locals = localAddressSet();
    return recs.some((r) => locals.has(r.address));
  } catch {
    return false;
  }
}
// 등록 검증: Allowlist 통과 여부만 본다.
// 같은 IP의 서브도메인은 vhost로 다른 앱일 수 있으므로 DNS 차단하지 않는다.
// (exact-origin 루프는 미들웨어 508 가드가 담당)
async function validateTarget(targetUrl) {
  if (!isAllowedTarget(targetUrl)) return "SSRF";
  return null;
}
function isAllowedTarget(targetUrl) {
  let u;
  try {
    u = new URL(targetUrl);
  } catch {
    return false;
  }
  if (BLOCKED.includes(u.hostname)) return false;
  if (isLocalHost(u.hostname)) return ALLOW_LOCAL;
  if (u.protocol !== "https:") return false;
  return u.hostname === DOMAIN || u.hostname.endsWith("." + DOMAIN);
}

function seedTarget(slug) {
  if (LOCAL_APPS) return `http://127.0.0.1:${slug === "library" ? 4511 : slug === "aiplatform" ? 4512 : 4513}`;
  return `https://${slug}.${DOMAIN}`;
}
let store = [
  { id: "seed-1", name: "러스트 라이브러리", slug: "library", targetUrl: seedTarget("library"), iconUrl: "/icons/library.svg", description: "도서·디지털 에셋 탐색", displayOrder: 0, isActive: true, category: "라이브러리" },
  { id: "seed-2", name: "AI Platform", slug: "aiplatform", targetUrl: seedTarget("aiplatform"), iconUrl: "/icons/ai.svg", description: "AI 챗·솔루션 허브", displayOrder: 1, isActive: true, category: "AI" },
  { id: "seed-3", name: "헬스케어", slug: "healthcare", targetUrl: seedTarget("healthcare"), iconUrl: "/icons/health.svg", description: "건강 대시보드", displayOrder: 2, isActive: true, category: "헬스케어" }
];
// 인메모리 권한 (DB 없을 때 CRUD 시연용). seed-admin은 전체, demo-user는 library만.
let permMem = [{ email: "user@rustkorea.cloud", slug: "library", accessLevel: "VIEW" }];
let auditMem = [];
let settingsMem = {
  platformDomain: DOMAIN, platformName: "러스트코리아", primaryColor: "#C2410C",
  logoUrl: "/logo.svg", allowedDomains: [DOMAIN],
  announcement: "", idleTimeoutMin: 3, menuOrder: []
};

async function getAllApps() {
  if (!prisma) return store;
  try {
    return await prisma.application.findMany({ orderBy: { displayOrder: "asc" } });
  } catch {
    return store;
  }
}
async function getSettings() {
  if (prisma) {
    try {
      const row = await prisma.platformSetting.findUnique({ where: { platformDomain: DOMAIN } });
      if (row) return row;
    } catch { /* fallthrough */ }
  }
  return settingsMem;
}
function publicSettings(s) {
  return {
    platformName: s.platformName, primaryColor: s.primaryColor, logoUrl: s.logoUrl,
    announcement: s.announcement || "", idleTimeoutMin: s.idleTimeoutMin || 3,
    menuOrder: s.menuOrder || []
  };
}
async function audit(actorId, action, target, result) {
  const row = { id: `m-${Date.now()}-${Math.random().toString(36).slice(2)}`, actorId, action, target, result, createdAt: new Date().toISOString() };
  auditMem.unshift(row);
  auditMem = auditMem.slice(0, 500);
  if (!prisma) return console.log("[audit]", action, actorId, target || "", result);
  try {
    await prisma.auditLog.create({ data: { actorId, action, target, result } });
  } catch { /* ignore */ }
}
function maskEmail(email) {
  const [id, d] = String(email).split("@");
  if (!d) return "***";
  return `${id.slice(0, 2)}***@${d}`;
}

const hits = new Map();
function checkLimit(key, limit, windowMs) {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || now > cur.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  cur.count += 1;
  return cur.count <= limit;
}

const AppCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  targetUrl: z.string().url(),
  iconUrl: z.string().min(1).max(500),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  category: z.string().max(50).default("전체"),
  stripPrefix: z.boolean().default(false), // true: 상대가 basePath 없이 루트 서빙 → /apps/<slug> 제거하고 그대로 전달
  openMode: z.enum(["embed", "direct"]).default("embed") // embed: /apps/<slug> 통합 보기, direct: targetUrl로 직접 이동
});
const AppPatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  targetUrl: z.string().url().optional(),
  iconUrl: z.string().min(1).max(500).optional(),
  description: z.string().max(500).nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  category: z.string().max(50).optional(),
  stripPrefix: z.boolean().optional(),
  openMode: z.enum(["embed", "direct"]).optional()
});
const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/subapps", express.static(path.join(__dirname, "subapps")));

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, code, message, status = 400) => res.status(status).json({ success: false, error: { code, message } });

function requireAdmin(req, res, next) {
  const c = verifySessionToken(req.cookies.session_token || "");
  if (!c || c.role !== "ADMIN") return fail(res, "FORBIDDEN", "ADMIN required", 403);
  req.claims = c;
  next();
}

app.get("/health", (req, res) => ok(res, { db: !!prisma, domain: DOMAIN, localApps: LOCAL_APPS }));

app.get("/api/platform", async (req, res) => ok(res, publicSettings(await getSettings())));

function orderCats(rows, menuOrder) {
  const map = new Map();
  for (const a of rows) {
    const c = a.category || "전체";
    map.set(c, (map.get(c) || 0) + 1);
  }
  const list = [...map.entries()].map(([name, count]) => ({ name, count }));
  const rank = new Map((menuOrder || []).map((n, i) => [n, i]));
  list.sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999) || a.name.localeCompare(b.name, "ko"));
  return list;
}

app.get("/api/categories", async (req, res) => {
  const rows = (await getAllApps()).filter((a) => a.isActive !== false);
  const s = await getSettings();
  return ok(res, orderCats(rows, s.menuOrder));
});

app.get("/api/apps", async (req, res) => {
  const rows = (await getAllApps()).filter((a) => a.isActive !== false);
  const cat = req.query.category;
  const out = cat && cat !== "전체" ? rows.filter((a) => (a.category || "전체") === cat) : rows;
  return ok(res, out);
});

app.post("/api/auth/login", async (req, res) => {
  const ip = req.ip || "local";
  if (!checkLimit(`auth:${ip}`, 5, 60000)) return fail(res, "RATE_LIMIT", "Too many attempts", 429);
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", "Invalid credentials format", 400);
  const { email, password } = parsed.data;

  if (prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && (await bcrypt.compare(password, user.passwordHash))) {
        try {
          await prisma.session.create({
            data: { userId: user.id, expiresAt: new Date(Date.now() + 24 * 3600 * 1000), idleAt: new Date(Date.now() + 2 * 3600 * 1000) }
          });
        } catch { /* ignore */ }
        await audit(user.id, "auth.login", undefined, "success");
        res.cookie("session_token", createSessionToken(user.id, user.role), {
          httpOnly: true, secure: IS_PROD, sameSite: "lax", path: "/", maxAge: MAX_AGE * 1000
        });
        return ok(res, { role: user.role });
      }
      await audit(email, "auth.login", undefined, "fail");
    } catch { /* 폴백 */ }
  }
  // 데모 계정 (DB 미연결): admin 전체 / user 제한
  const demo = { "admin@rustkorea.cloud": ["Admin123!", "ADMIN"], "user@rustkorea.cloud": ["User123!", "USER"] }[email];
  if (!prisma && demo && password === demo[0]) {
    const uid = email === "admin@rustkorea.cloud" ? "seed-admin" : "demo-user";
    res.cookie("session_token", createSessionToken(uid, demo[1]), {
      httpOnly: true, secure: IS_PROD, sameSite: "lax", path: "/", maxAge: MAX_AGE * 1000
    });
    return ok(res, { role: demo[1] });
  }
  return fail(res, "UNAUTH", "이메일 또는 비밀번호가 올바르지 않습니다.", 401);
});

async function slugsFor(claims) {
  const rows = (await getAllApps()).filter((a) => a.isActive !== false);
  if (claims.role === "ADMIN" || claims.userId === "seed-admin") return rows.map((a) => a.slug);
  if (prisma) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: claims.userId }, include: { permissions: { include: { app: true } } }
      });
      if (user) return user.permissions.filter((p) => p.app.isActive).map((p) => p.app.slug);
    } catch { /* fallthrough */ }
  }
  if (claims.userId === "demo-user") {
    const granted = permMem.filter((p) => p.email === "user@rustkorea.cloud").map((p) => p.slug);
    return rows.filter((a) => granted.includes(a.slug)).map((a) => a.slug);
  }
  return rows.map((a) => a.slug);
}

app.get("/api/auth/me", async (req, res) => {
  const c = verifySessionToken(req.cookies.session_token || "");
  if (!c) return fail(res, "UNAUTH", "No session", 401);
  let email = c.userId === "seed-admin" ? "ad***@rustkorea.cloud"
    : c.userId === "demo-user" ? "us***@rustkorea.cloud" : undefined;
  if (prisma && c.userId !== "seed-admin" && c.userId !== "demo-user" && c.userId !== "demo") {
    try {
      const user = await prisma.user.findUnique({ where: { id: c.userId } });
      if (user) email = maskEmail(user.email);
    } catch { /* ignore */ }
  }
  return ok(res, { email, role: c.role, apps: await slugsFor(c) });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("session_token", { path: "/" });
  return ok(res, null);
});

// ----- Admin: apps -----
app.get("/api/admin/apps", requireAdmin, async (req, res) => ok(res, await getAllApps()));

app.post("/api/admin/apps", requireAdmin, async (req, res) => {
  const ip = req.ip || "local";
  if (!checkLimit(`admin:${ip}`, 100, 60000)) return fail(res, "RATE_LIMIT", "Too many requests", 429);
  const parsed = AppCreateSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", parsed.error.message, 400);
  const v = await validateTarget(parsed.data.targetUrl);
  if (v === "SSRF") {
    await audit(req.claims.userId, "app.register", parsed.data.slug, "fail");
    return fail(res, "SSRF", "targetUrl not in Allowlist", 403);
  }
  if (!prisma) {
    if (store.some((a) => a.slug === parsed.data.slug)) return fail(res, "CONFLICT", "slug 중복", 409);
    const row = { ...parsed.data, id: `local-${Date.now()}` };
    store.push(row);
    store.sort((a, b) => a.displayOrder - b.displayOrder);
    await audit(req.claims.userId, "app.register", row.slug, "success");
    return ok(res, row, 201);
  }
  const created = await prisma.application.create({ data: parsed.data });
  await audit(req.claims.userId, "app.register", created.slug, "success");
  return ok(res, created, 201);
});

app.patch("/api/admin/apps", requireAdmin, async (req, res) => {
  const parsed = AppPatchSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", parsed.error.message, 400);
  const { id, ...data } = parsed.data;
  if (data.targetUrl) {
    const v = await validateTarget(data.targetUrl);
    if (v === "SSRF") {
      return fail(res, "SSRF", "targetUrl not in Allowlist", 403);
    }
  }
  if (!prisma) {
    const i = store.findIndex((a) => a.id === id);
    if (i < 0) return fail(res, "NOT_FOUND", "앱 없음", 404);
    if (data.slug && store.some((a) => a.slug === data.slug && a.id !== id)) {
      return fail(res, "CONFLICT", "slug 중복", 409);
    }
    store[i] = { ...store[i], ...data };
    store.sort((a, b) => a.displayOrder - b.displayOrder);
    await audit(req.claims.userId, "app.update", id, "success");
    return ok(res, store[i]);
  }
  try {
    const updated = await prisma.application.update({ where: { id }, data });
    await audit(req.claims.userId, "app.update", id, "success");
    return ok(res, updated);
  } catch {
    return fail(res, "NOT_FOUND", "앱 없음", 404);
  }
});

app.delete("/api/admin/apps", requireAdmin, async (req, res) => {
  const { id } = req.query;
  if (!id) return fail(res, "VALIDATION", "id required", 400);
  if (!prisma) {
    store = store.filter((a) => a.id !== String(id));
    permMem = permMem.filter((p) => p.slug !== store.find((a) => a.id === String(id))?.slug);
  } else {
    try {
      await prisma.application.delete({ where: { id: String(id) } });
    } catch { /* ignore */ }
  }
  await audit(req.claims.userId, "app.delete", String(id), "success");
  return ok(res, null);
});

// ----- Admin: categories -----
// PATCH {from, to} 이름 변경 / DELETE ?from=&moveTo= (앱 이동 후 메뉴에서 제거)
app.patch("/api/admin/categories", requireAdmin, async (req, res) => {
  const parsed = z.object({ from: z.string().min(1).max(50), to: z.string().min(1).max(50) }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", parsed.error.message, 400);
  const { from, to } = parsed.data;
  if (!prisma) {
    let n = 0;
    store.forEach((a) => { if ((a.category || "전체") === from) { a.category = to; n++; } });
    if (!n) return fail(res, "NOT_FOUND", "해당 카테고리 없음", 404);
    const s = await getSettings();
    const mo = (s.menuOrder || []).map((m) => (m === from ? to : m));
    if (prisma) { /* 아래에서 처리 */ } else { settingsMem.menuOrder = mo; }
    await audit(req.claims.userId, "category.rename", `${from}→${to}`, "success");
    return ok(res, { renamed: n });
  }
  const r = await prisma.application.updateMany({ where: { category: from }, data: { category: to } });
  await audit(req.claims.userId, "category.rename", `${from}→${to}`, "success");
  return ok(res, { renamed: r.count });
});

app.delete("/api/admin/categories", requireAdmin, async (req, res) => {
  const from = String(req.query.from || "");
  const moveTo = String(req.query.moveTo || "전체");
  if (!from) return fail(res, "VALIDATION", "from required", 400);
  if (!prisma) {
    const targets = store.filter((a) => (a.category || "전체") === from);
    if (!targets.length) return fail(res, "NOT_FOUND", "해당 카테고리 없음", 404);
    targets.forEach((a) => { a.category = moveTo; });
    settingsMem.menuOrder = (settingsMem.menuOrder || []).filter((m) => m !== from);
    await audit(req.claims.userId, "category.delete", `${from}→${moveTo}`, "success");
    return ok(res, { moved: targets.length });
  }
  const r = await prisma.application.updateMany({ where: { category: from }, data: { category: moveTo } });
  await audit(req.claims.userId, "category.delete", `${from}→${moveTo}`, "success");
  return ok(res, { moved: r.count });
});

// ----- Admin: permissions -----
app.get("/api/admin/permissions", requireAdmin, async (req, res) => {
  if (prisma) {
    try {
      const rows = await prisma.userAppPermission.findMany({
        where: req.query.appId ? { appId: String(req.query.appId) } : {},
        include: { user: { select: { email: true } }, app: { select: { slug: true } } }
      });
      return ok(res, rows.map((r) => ({ email: r.user.email, slug: r.app.slug, accessLevel: r.accessLevel })));
    } catch { /* fallthrough */ }
  }
  return ok(res, permMem);
});

app.post("/api/admin/permissions", requireAdmin, async (req, res) => {
  const parsed = z.object({
    email: z.string().email(), slug: z.string().min(1),
    accessLevel: z.enum(["VIEW", "ADMIN"]).default("VIEW")
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", parsed.error.message, 400);
  if (prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      const appRow = await prisma.application.findUnique({ where: { slug: parsed.data.slug } });
      if (!user || !appRow) return fail(res, "NOT_FOUND", "사용자 또는 앱 없음", 404);
      await prisma.userAppPermission.upsert({
        where: { userId_appId: { userId: user.id, appId: appRow.id } },
        update: { accessLevel: parsed.data.accessLevel },
        create: { userId: user.id, appId: appRow.id, accessLevel: parsed.data.accessLevel }
      });
      await audit(req.claims.userId, "permission.grant", `${parsed.data.email}:${parsed.data.slug}`, "success");
      return ok(res, parsed.data, 201);
    } catch { /* fallthrough */ }
  }
  const i = permMem.findIndex((p) => p.email === parsed.data.email && p.slug === parsed.data.slug);
  if (i >= 0) permMem[i] = parsed.data;
  else permMem.push(parsed.data);
  await audit(req.claims.userId, "permission.grant", `${parsed.data.email}:${parsed.data.slug}`, "success");
  return ok(res, parsed.data, 201);
});

app.delete("/api/admin/permissions", requireAdmin, async (req, res) => {
  const { email, slug } = req.query;
  if (!email || !slug) return fail(res, "VALIDATION", "email, slug required", 400);
  if (prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { email: String(email) } });
      const appRow = await prisma.application.findUnique({ where: { slug: String(slug) } });
      if (user && appRow) {
        await prisma.userAppPermission.delete({ where: { userId_appId: { userId: user.id, appId: appRow.id } } });
      }
    } catch { /* ignore */ }
  }
  permMem = permMem.filter((p) => !(p.email === email && p.slug === slug));
  await audit(req.claims.userId, "permission.revoke", `${email}:${slug}`, "success");
  return ok(res, null);
});

// ----- Admin: settings -----
const SettingsSchema = z.object({
  platformName: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl: z.string().max(500).optional(),
  announcement: z.string().max(300).optional(),
  idleTimeoutMin: z.number().int().min(1).max(30).optional(),
  menuOrder: z.array(z.string().max(50)).max(50).optional()
});

app.get("/api/admin/settings", requireAdmin, async (req, res) => ok(res, publicSettings(await getSettings())));

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", parsed.error.message, 400);
  if (prisma) {
    try {
      const row = await prisma.platformSetting.update({ where: { platformDomain: DOMAIN }, data: parsed.data });
      await audit(req.claims.userId, "settings.update", undefined, "success");
      return ok(res, publicSettings(row));
    } catch { /* fallthrough */ }
  }
  settingsMem = { ...settingsMem, ...parsed.data };
  await audit(req.claims.userId, "settings.update", undefined, "success");
  return ok(res, publicSettings(settingsMem));
});

// ----- Admin: audit -----
app.get("/api/admin/audit", requireAdmin, async (req, res) => {
  if (prisma) {
    try {
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
      return ok(res, rows);
    } catch { /* fallthrough */ }
  }
  return ok(res, auditMem.slice(0, Math.min(Number(req.query.limit || 50), 200)));
});

app.listen(PORT, () => console.log(`api-server on :${PORT} (db=${!!prisma}, localApps=${LOCAL_APPS})`));
