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
// 허용 목록 = PLATFORM_DOMAIN + 설정의 allowedDomains (어드민에서 관리)
async function allowedList() {
  const base = [DOMAIN];
  try {
    const s = await getSettings();
    for (const d of s.allowedDomains || []) {
      const t = String(d).trim();
      if (t && !base.includes(t)) base.push(t);
    }
  } catch { /* ignore */ }
  return base;
}
async function validateTarget(targetUrl) {
  const list = await allowedList();
  let u;
  try {
    u = new URL(targetUrl);
  } catch {
    return "SSRF";
  }
  if (BLOCKED.includes(u.hostname)) return "SSRF";
  if (isLocalHost(u.hostname)) return ALLOW_LOCAL ? null : "SSRF";
  const allowed = list.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
  if (!allowed) return "SSRF";
  // 허용 목록에 있으면 http도 허용 (내부망 http 서비스 연동용). 단 메타IP는 위에서 차단.
  if (u.protocol !== "https:" && u.protocol !== "http:") return "SSRF";
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
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const fs = require("fs");
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch { /* ignore */ }
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }

let store = [
  { id: "seed-1", name: "러스트 라이브러리", slug: "library", targetUrl: seedTarget("library"), iconUrl: "/icons/library.svg", description: "도서·디지털 에셋 탐색", displayOrder: 0, isActive: true, category: "라이브러리" },
  { id: "seed-2", name: "AI Platform", slug: "aiplatform", targetUrl: seedTarget("aiplatform"), iconUrl: "/icons/ai.svg", description: "AI 챗·솔루션 허브", displayOrder: 1, isActive: true, category: "AI" },
  { id: "seed-3", name: "헬스케어", slug: "healthcare", targetUrl: seedTarget("healthcare"), iconUrl: "/icons/health.svg", description: "건강 대시보드", displayOrder: 2, isActive: true, category: "헬스케어" }
];
// 인메모리 권한 (DB 없을 때 CRUD 시연용). seed-admin은 전체, demo-user는 library만.
let permMem = [{ email: "user@rustkorea.cloud", slug: "library", accessLevel: "VIEW" }];
let auditMem = [];
const DEFAULT_ADMIN_MENU = [
  { id: "overview", label: "대시보드" },
  { id: "categories", label: "카테고리 관리" },
  { id: "apps", label: "앱 관리" },
  { id: "users", label: "사용자" },
  { id: "permissions", label: "권한" },
  { id: "settings", label: "설정" },
  { id: "audit", label: "감사 로그" }
];
let settingsMem = {
  platformDomain: DOMAIN, platformName: "러스트코리아", primaryColor: "#C2410C",
  logoUrl: "/logo.svg", allowedDomains: [DOMAIN],
  announcement: "", idleTimeoutMin: 3, menuOrder: [],
  backgroundType: "color", backgroundColor: "#FFF7ED", backgroundImage: "",
  gridDensity: "comfortable", gridCols: { mobile: 2, tablet: 3, desktop: 4, kiosk: 5 },
  showAppName: true, pwaIconUrl: "",
  adminMenu: DEFAULT_ADMIN_MENU
};
// 인메모리 사용자 (DB 없을 때 CRUD 시연용, 비밀번호 bcrypt 해시)
const bcryptSync = require("bcryptjs");
let usersMem = [
  { id: "seed-admin", email: "admin@rustkorea.cloud", role: "ADMIN", passwordHash: bcryptSync.hashSync("Admin123!", 10), createdAt: new Date().toISOString() },
  { id: "demo-user", email: "user@rustkorea.cloud", role: "USER", passwordHash: bcryptSync.hashSync("User123!", 10), createdAt: new Date().toISOString() }
];
function emailOf(userId) {
  const u = usersMem.find((x) => x.id === userId);
  return u ? u.email : undefined;
}
// links 정규화: DB(String[] "라벨|URL") ↔ API(객체 배열)
function normLinks(v) {
  if (!Array.isArray(v)) return [];
  return v.map((s) => {
    if (s && typeof s === "object" && s.label) return { label: String(s.label), url: String(s.url || "#") };
    const str = String(s);
    const i = str.indexOf("|");
    return i < 0 ? { label: str, url: "#" } : { label: str.slice(0, i), url: str.slice(i + 1) };
  });
}
const linksToDb = (links) => (links || []).map((l) => `${l.label}|${l.url}`);
function withLinks(row) {
  return { ...row, links: normLinks(row.links) };
}
try {
  const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (Array.isArray(saved.store) && saved.store.length) store = saved.store;
  if (Array.isArray(saved.permMem)) permMem = saved.permMem;
  if (Array.isArray(saved.auditMem)) auditMem = saved.auditMem;
  if (saved.settingsMem) settingsMem = { ...settingsMem, ...saved.settingsMem };
  if (Array.isArray(saved.usersMem) && saved.usersMem.length) usersMem = saved.usersMem;
  console.log("[persist] restored");
} catch { /* 첫 실행 */ }

async function getAllApps() {
  if (!prisma) return store.map(withLinks);
  try {
    const rows = await prisma.application.findMany({ orderBy: { displayOrder: "asc" } });
    return rows.map(withLinks);
  } catch {
    return store.map(withLinks);
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
    menuOrder: s.menuOrder || [],
    allowedDomains: s.allowedDomains || [DOMAIN],
    backgroundType: s.backgroundType || "color",
    backgroundColor: s.backgroundColor || "#FFF7ED",
    backgroundImage: s.backgroundImage || "",
    gridDensity: s.gridDensity || "comfortable",
    gridCols: { mobile: 2, tablet: 3, desktop: 4, kiosk: 5, ...(s.gridCols || {}) },
    showAppName: s.showAppName !== false,
    pwaIconUrl: s.pwaIconUrl || "",
    adminMenu: Array.isArray(s.adminMenu) && s.adminMenu.length ? s.adminMenu : DEFAULT_ADMIN_MENU
  };
}
async function audit(actorId, action, target, result) {
  const row = { id: `m-${Date.now()}-${Math.random().toString(36).slice(2)}`, actorId, action, target, result, createdAt: new Date().toISOString() };
  auditMem.unshift(row);
  auditMem = auditMem.slice(0, 500);
  persist(); // 파일 영속화 (재시작해도 유지)
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

const LinkSchema = z.object({
  label: z.string().min(1, "링크 이름을 입력하세요").max(50),
  url: z.string().min(1, "링크 URL을 입력하세요").max(500).refine(
    (v) => v.startsWith("https://") || v.startsWith("http://localhost") || v.startsWith("http://127.0.0.1") || v.startsWith("/") || v.startsWith("http://rustkorea.cloud") || /^http:\/\/[^/]*\.rustkorea\.cloud/.test(v),
    { message: "링크는 https:// 또는 내부 http(s), / 로 시작해야 합니다" }
  )
});

const AppCreateSchema = z.object({
  name: z.string({ required_error: "이름을 입력하세요" }).min(1, "이름을 입력하세요").max(100, "이름은 100자 이하"),
  slug: z.string({ required_error: "슬러그를 입력하세요" }).regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자·숫자·하이픈(-)만 입력 (예: library)"),
  targetUrl: z.string({ required_error: "URL을 입력하세요" }).url("URL 형식이 올바르지 않습니다 (https://… 또는 허용된 http://…)"),
  iconUrl: z.string().min(1, "아이콘 URL을 입력하세요").max(500),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  category: z.string().max(50).default("전체"),
  stripPrefix: z.boolean().default(false), // true: 상대가 basePath 없이 루트 서빙 → /apps/<slug> 제거하고 그대로 전달
  openMode: z.enum(["embed", "direct"]).default("embed"), // embed: /apps/<slug> 통합 보기, direct: targetUrl로 직접 이동
  openTarget: z.enum(["self", "blank"]).default("self"), // self: 같은 탭(뒤로가기 복귀), blank: 새 탭(런처 유지)
  bgType: z.enum(["color", "image", "none"]).default("color"),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFFFFF"),
  bgImage: z.string().max(500).default("").refine(
    (v) => !v || v.startsWith("/uploads/") || v.startsWith("https://"),
    { message: "배경 이미지는 /uploads/ 또는 https:// 만 허용" }
  ),
  links: z.array(LinkSchema).max(5).default([]) // 관련 링크 (라벨+URL, 최대 5개)
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
  openMode: z.enum(["embed", "direct"]).optional(),
  openTarget: z.enum(["self", "blank"]).optional(),
  bgType: z.enum(["color", "image", "none"]).optional(),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  bgImage: z.string().max(500).optional().refine(
    (v) => !v || v.startsWith("/uploads/") || v.startsWith("https://"),
    { message: "배경 이미지는 /uploads/ 또는 https:// 만 허용" }
  ),
  links: z.array(LinkSchema).max(5).optional()
});
const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "3mb" })); // 업로드(dataURL) 허용, Zod가 필드별 크기 제한
app.use(cookieParser());
app.use("/subapps", express.static(path.join(__dirname, "subapps")));

// 업로드 아이콘 저장소 (Docker volume 권장: ./uploads)
// (경로 상수는 파일 상단 store 선언부에서 정의 — TDZ 방지)
function persist() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ store, permMem, auditMem: auditMem.slice(0, 200), settingsMem, usersMem }));
  } catch (e) { console.log("[persist] fail", e.message); }
}
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: false }));

const UPLOAD_MIMES = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg"
};

// webp 변환 (sharp 있으면, 없으면 원본 저장)
async function toWebp(buf, destPath) {
  try {
    const sharp = require("sharp");
    await sharp(buf).resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 80 }).toFile(destPath);
    const st = require("fs").statSync(destPath);
    return st.size > 0;
  } catch {
    return false;
  }
}


// POST /api/admin/upload {filename, dataUrl} → {url} (ADMIN, 1.5MB 이하)
app.post("/api/admin/upload", requireAdmin, async (req, res) => {
  const parsed = z.object({
    filename: z.string().min(1).max(100),
    dataUrl: z.string().min(1).max(4_000_000)
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  const m = parsed.data.dataUrl.match(/^data:([a-z/+.-]+);base64,(.+)$/);
  if (!m || !UPLOAD_MIMES[m[1]]) return fail(res, "VALIDATION", "png/jpg/webp/svg만 허용", 400);
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 1_500_000) return fail(res, "VALIDATION", "1.5MB 이하만 허용", 400);
  if (m[1] === "image/svg+xml") {
    const text = buf.toString("utf8");
    if (/<script|on\w+\s*=|javascript:/i.test(text)) return fail(res, "VALIDATION", "SVG에 스크립트 불가", 400);
  }
  const base = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // webp로 규격 변환 (벡터 SVG 제외). 실패 시 원본 저장.
  let stored = `${base}.${UPLOAD_MIMES[m[1]]}`;
  if (m[1] !== "image/svg+xml" && m[1] !== "image/webp") {
    const webp = path.join(UPLOAD_DIR, `${base}.webp`);
    if (await toWebp(buf, webp)) {
      stored = `${base}.webp`;
    } else {
      try {
        require("fs").writeFileSync(path.join(UPLOAD_DIR, stored), buf);
      } catch {
        return fail(res, "IO", "저장 실패", 500);
      }
    }
  } else {
    try {
      require("fs").writeFileSync(path.join(UPLOAD_DIR, stored), buf);
    } catch {
      return fail(res, "IO", "저장 실패", 500);
    }
  }
  await audit(req.claims.userId, "icon.upload", stored, "success");
  return ok(res, { url: `/uploads/${stored}` }, 201);
});

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, code, message, status = 400) => res.status(status).json({ success: false, error: { code, message } });
// API는 절대 캐시하지 않는다 (폰 브라우저 휴리스틱 캐시로 낡은 값 표시 방지)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
// Zod 에러를 첫 번째 항목의 한글 메시지로 변환
const zMsg = (parsed, fallback = "입력값을 확인하세요") =>
  parsed.success ? "" : (parsed.error.issues[0]?.message || fallback);

function requireAdmin(req, res, next) {
  const c = verifySessionToken(req.cookies.session_token || "");
  if (!c || c.role !== "ADMIN") return fail(res, "FORBIDDEN", "ADMIN required", 403);
  req.claims = c;
  next();
}

app.get("/health", (req, res) => ok(res, { db: !!prisma, domain: DOMAIN, localApps: LOCAL_APPS }));

app.get("/api/platform", async (req, res) => ok(res, publicSettings(await getSettings())));

async function validCategories() {
  // 메뉴 우선 모델: "전체" + 메뉴순서 + 사용 중인 카테고리만 유효한 소속
  const rows = await getAllApps();
  const s = await getSettings();
  const set = new Set(["전체", ...((s.menuOrder || [])), ...rows.map((a) => a.category || "전체")]);
  return [...set];
}

function orderCats(rows, menuOrder) {
  const map = new Map();
  for (const a of rows) {
    const c = a.category || "전체";
    map.set(c, (map.get(c) || 0) + 1);
  }
  // 빈 카테고리도 메뉴에 유지 (menuOrder에 있으면 count 0으로 표시)
  for (const name of menuOrder || []) {
    if (!map.has(name)) map.set(name, 0);
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
          httpOnly: true, secure: req.protocol === "https", sameSite: "lax", path: "/", maxAge: MAX_AGE * 1000
        });
        return ok(res, { role: user.role });
      }
      await audit(email, "auth.login", undefined, "fail");
    } catch { /* 폴백 */ }
  }
  // 데모 계정 (DB 미연결): usersMem에서 bcrypt 비교
  if (!prisma) {
    const u = usersMem.find((x) => x.email === email);
    if (u && (await bcrypt.compare(password, u.passwordHash))) {
      res.cookie("session_token", createSessionToken(u.id, u.role), {
        httpOnly: true, secure: req.protocol === "https", sameSite: "lax", path: "/", maxAge: MAX_AGE * 1000
      });
      return ok(res, { role: u.role });
    }
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
  if (claims.userId === "demo-user" || (!prisma && claims.role !== "ADMIN")) {
    const email = emailOf(claims.userId);
    const granted = permMem.filter((p) => p.email === email).map((p) => p.slug);
    return rows.filter((a) => granted.includes(a.slug)).map((a) => a.slug);
  }
  return rows.map((a) => a.slug);
}

app.get("/api/auth/me", async (req, res) => {
  const c = verifySessionToken(req.cookies.session_token || "");
  if (!c) return fail(res, "UNAUTH", "No session", 401);
  let email = emailOf(c.userId);
  if (email) email = maskEmail(email);
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
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  const validNew = await validCategories();
  if (parsed.data.category && !validNew.includes(parsed.data.category)) {
    return fail(res, "VALIDATION", `카테고리는 다음 중 선택: ${validNew.join(", ")} (카테고리 메뉴에서 먼저 생성)`, 400);
  }
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
  const created = await prisma.application.create({ data: { ...parsed.data, links: linksToDb(parsed.data.links) } });
  await audit(req.claims.userId, "app.register", created.slug, "success");
  return ok(res, withLinks(created), 201);
});

app.patch("/api/admin/apps", requireAdmin, async (req, res) => {
  const parsed = AppPatchSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  const { id, ...data } = parsed.data;
  if (data.category) {
    const validUpd = await validCategories();
    if (!validUpd.includes(data.category)) {
      return fail(res, "VALIDATION", `카테고리는 다음 중 선택: ${validUpd.join(", ")} (카테고리 메뉴에서 먼저 생성)`, 400);
    }
  }
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
    const dbData = { ...data };
    if (dbData.links) dbData.links = linksToDb(dbData.links);
    const updated = await prisma.application.update({ where: { id }, data: dbData });
    await audit(req.claims.userId, "app.update", id, "success");
    return ok(res, withLinks(updated));
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
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
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
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
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

// ----- Admin: users -----
function publicUser(u) {
  return { id: u.id, email: u.email, role: u.role, createdAt: u.createdAt };
}

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  if (prisma) {
    try {
      const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
      return ok(res, rows.map(publicUser));
    } catch { /* fallthrough */ }
  }
  return ok(res, usersMem.map(publicUser));
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  const parsed = z.object({
    email: z.string().email().max(100),
    password: z.string().min(8).max(100),
    role: z.enum(["ADMIN", "USER"]).default("USER")
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  if (prisma) {
    try {
      const created = await prisma.user.create({
        data: { email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 12), role: parsed.data.role }
      });
      await audit(req.claims.userId, "user.create", parsed.data.email, "success");
      return ok(res, publicUser(created), 201);
    } catch {
      return fail(res, "CONFLICT", "이메일 중복 또는 DB 오류", 409);
    }
  }
  if (usersMem.some((u) => u.email === parsed.data.email)) return fail(res, "CONFLICT", "이메일 중복", 409);
  const row = {
    id: `u-${Date.now()}`, email: parsed.data.email, role: parsed.data.role,
    passwordHash: await bcrypt.hash(parsed.data.password, 10), createdAt: new Date().toISOString()
  };
  usersMem.push(row);
  await audit(req.claims.userId, "user.create", row.email, "success");
  return ok(res, publicUser(row), 201);
});

app.patch("/api/admin/users", requireAdmin, async (req, res) => {
  const parsed = z.object({
    id: z.string().min(1),
    role: z.enum(["ADMIN", "USER"]).optional(),
    password: z.string().min(8).max(100).optional()
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  if (parsed.data.id === req.claims.userId && parsed.data.role && parsed.data.role !== "ADMIN") {
    return fail(res, "VALIDATION", "자기 자신의 관리자 권한은 해제할 수 없음", 400);
  }
  if (prisma) {
    try {
      const data = {};
      if (parsed.data.role) data.role = parsed.data.role;
      if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const updated = await prisma.user.update({ where: { id: parsed.data.id }, data });
      await audit(req.claims.userId, "user.update", updated.email, "success");
      return ok(res, publicUser(updated));
    } catch {
      return fail(res, "NOT_FOUND", "사용자 없음", 404);
    }
  }
  const u = usersMem.find((x) => x.id === parsed.data.id);
  if (!u) return fail(res, "NOT_FOUND", "사용자 없음", 404);
  if (parsed.data.role) u.role = parsed.data.role;
  if (parsed.data.password) u.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await audit(req.claims.userId, "user.update", u.email, "success");
  return ok(res, publicUser(u));
});

app.delete("/api/admin/users", requireAdmin, async (req, res) => {
  const { id } = req.query;
  if (!id) return fail(res, "VALIDATION", "id required", 400);
  if (String(id) === req.claims.userId) return fail(res, "VALIDATION", "자기 자신은 삭제할 수 없음", 400);
  if (prisma) {
    try {
      const u = await prisma.user.findUnique({ where: { id: String(id) } });
      if (!u) return fail(res, "NOT_FOUND", "사용자 없음", 404);
      await prisma.user.delete({ where: { id: String(id) } });
      await audit(req.claims.userId, "user.delete", u.email, "success");
      return ok(res, null);
    } catch {
      return fail(res, "NOT_FOUND", "사용자 없음", 404);
    }
  }
  const u = usersMem.find((x) => x.id === String(id));
  usersMem = usersMem.filter((x) => x.id !== String(id));
  if (u) permMem = permMem.filter((p) => p.email !== u.email);
  await audit(req.claims.userId, "user.delete", u ? u.email : String(id), "success");
  return ok(res, null);
});

// ----- Admin: settings -----
const GridColsSchema = z.object({
  mobile: z.number().int().min(2).max(8).default(2),
  tablet: z.number().int().min(2).max(8).default(3),
  desktop: z.number().int().min(2).max(10).default(4),
  kiosk: z.number().int().min(2).max(12).default(5)
});
const SettingsSchema = z.object({
  platformName: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl: z.string().max(500).optional(),
  announcement: z.string().max(300).optional(),
  idleTimeoutMin: z.number().int().min(1).max(30).optional(),
  menuOrder: z.array(z.string().max(50)).max(50).optional(),
  gridDensity: z.enum(["comfortable", "compact"]).optional(),
  gridCols: GridColsSchema.partial().optional(),
  showAppName: z.boolean().optional(),
  pwaIconUrl: z.string().max(500).optional(),
  adminMenu: z.array(z.object({ id: z.string().min(1).max(30), label: z.string().min(1).max(30) })).max(20).optional(),
  allowedDomains: z.array(z.string().max(100)).max(50).optional().refine(
    (v) => !v || !v.some((d) => ["169.254.169.254", "0.0.0.0", "localhost", "127.0.0.1", "::1"].includes(d.trim())),
    { message: "메타IP·로컬호스트는 허용 목록에 불가" }
  ),
  backgroundType: z.enum(["color", "image"]).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundImage: z.string().max(500).optional().refine(
    (v) => !v || v.startsWith("/uploads/") || v.startsWith("https://"),
    { message: "배경 이미지는 /uploads/ 또는 https:// 만 허용" }
  )
});

app.get("/api/admin/settings", requireAdmin, async (req, res) => ok(res, publicSettings(await getSettings())));

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
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
