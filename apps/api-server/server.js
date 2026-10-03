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
let templatesMem = [];
let eventsMem = [];
let devicesMem = [];
let datasetsMem = [];
// 인메모리 권한 (DB 없을 때 CRUD 시연용). seed-admin은 전체, demo-user는 library만.
let permMem = [{ email: "user@rustkorea.cloud", slug: "library", accessLevel: "VIEW" }];
let auditMem = [];
const DEFAULT_ADMIN_MENU = [
  { id: "overview", label: "대시보드" },
  { id: "categories", label: "카테고리 관리" },
  { id: "apps", label: "앱 관리" },
  { id: "templates", label: "템플릿" },
  { id: "stats", label: "현황" },
  { id: "devices", label: "장비 관리" },
  { id: "users", label: "사용자" },
  { id: "permissions", label: "권한" },
  { id: "settings", label: "설정" },
  { id: "audit", label: "감사 로그" }
];
// 구 메뉴(장비 항목 없음)에 새 항목 자동 병합
function mergeMenu(saved) {
  const base = Array.isArray(saved) && saved.length ? saved : DEFAULT_ADMIN_MENU;
  const ids = new Set(base.map((m) => m.id));
  const merged = [...base];
  for (const d of DEFAULT_ADMIN_MENU) {
    if (!ids.has(d.id)) {
      const at = d.id === "devices" ? 3 : merged.length;
      merged.splice(Math.min(at, merged.length), 0, { ...d });
    }
  }
  return merged.filter((m) => DEFAULT_ADMIN_MENU.some((d) => d.id === m.id));
}
let settingsMem = {
  platformDomain: DOMAIN, platformName: "러스트코리아", primaryColor: "#C2410C",
  logoUrl: "/logo.svg", allowedDomains: [DOMAIN],
  announcement: "", idleTimeoutMin: 3, menuOrder: [],
  backgroundType: "color", backgroundColor: "#FFF7ED", backgroundImage: "",
  gridDensity: "comfortable", gridCols: { mobile: 2, tablet: 3, desktop: 4, kiosk: 5 },
  showAppName: true, pwaIconUrl: "",
  adminMenu: DEFAULT_ADMIN_MENU,
  requireApprovedDevice: false
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
  console.log("[persist] trying", DATA_FILE);
  const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (Array.isArray(saved.store) && saved.store.length) store = saved.store;
  if (Array.isArray(saved.permMem)) permMem = saved.permMem;
  if (Array.isArray(saved.auditMem)) auditMem = saved.auditMem;
  if (saved.settingsMem) settingsMem = { ...settingsMem, ...saved.settingsMem };
  if (Array.isArray(saved.usersMem) && saved.usersMem.length) usersMem = saved.usersMem;
  if (Array.isArray(saved.devicesMem)) devicesMem = saved.devicesMem;
  if (Array.isArray(saved.templatesMem)) templatesMem = saved.templatesMem;
  if (Array.isArray(saved.datasetsMem)) datasetsMem = saved.datasetsMem;
  if (Array.isArray(saved.eventsMem)) eventsMem = saved.eventsMem;
  console.log("[persist] restored");
} catch (e) { console.log("[persist] restore failed:", e.message); }

async function getAllApps() {
  // 앱 + 게시된 템플릿(런처 그리드·카테고리·장비배정에 그대로 노출)
  const tplRows = async () => {
    if (prisma) {
      try {
        const rows = await prisma.template.findMany({ where: { status: "published" } });
        return rows.map((r) => toAppRow({ ...r, ...(JSON.parse(r.body || '{"pages":[]}')) }));
      } catch { /* fallthrough */ }
    }
    return templatesMem.filter((t) => t.status === "published").map(toAppRow);
  };
  const tpls = await tplRows();
  if (!prisma) return [...store.map(withLinks), ...tpls];
  try {
    const rows = await prisma.application.findMany({ orderBy: { displayOrder: "asc" } });
    return [...rows.map(withLinks), ...tpls];
  } catch {
    return [...store.map(withLinks), ...tpls];
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
    requireApprovedDevice: s.requireApprovedDevice === true,
    pwaIconUrl: s.pwaIconUrl || "",
    adminMenu: mergeMenu(Array.isArray(s.adminMenu) && s.adminMenu.length ? s.adminMenu : DEFAULT_ADMIN_MENU)
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
    fs.writeFileSync(DATA_FILE, JSON.stringify({ store, permMem, auditMem: auditMem.slice(0, 200), settingsMem, usersMem, devicesMem, templatesMem, datasetsMem, eventsMem: eventsMem.slice(-1000) }));
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

// ----- 장비 관리 (사이니지형 승인제) -----
// 브라우저 PWA는 하드웨어 UUID를 읽을 수 없어 설치 시 발급한 UUID + 페어링 코드로 승인.
// devicesMem: {id, uuid, name, code, status: pending|approved|rejected, lastSeen, createdAt}
// (let devicesMem은 상단 선언부에서 초기화 — TDZ 방지)
function deviceCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/device/register {uuid, name?, info?} → {code, status}
app.post("/api/device/register", async (req, res) => {
  const parsed = z.object({
    uuid: z.string().min(8).max(100),
    name: z.string().max(100).optional(),
    info: z.string().max(300).optional(),
    screen: z.string().max(20).optional(),
    placement: z.string().max(100).optional()
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  if (prisma) {
    try {
      const row = await prisma.device.upsert({
        where: { uuid: parsed.data.uuid },
        update: { name: parsed.data.name, screen: parsed.data.screen, lastSeen: new Date() },
        create: { uuid: parsed.data.uuid, name: parsed.data.name || "미지정 장비", code: deviceCode(), status: "pending", screen: parsed.data.screen || "", placement: parsed.data.placement || "", lastSeen: new Date() }
      });
      return ok(res, { code: row.code, status: row.status });
    } catch { /* fallthrough */ }
  }
  let d = devicesMem.find((x) => x.uuid === parsed.data.uuid);
  if (!d) {
    d = { id: `d-${Date.now()}`, uuid: parsed.data.uuid, name: parsed.data.name || "미지정 장비", code: deviceCode(), status: "pending", screen: parsed.data.screen || "", placement: parsed.data.placement || "", storagePct: -1, lastSeen: new Date().toISOString(), createdAt: new Date().toISOString() };
    devicesMem.push(d);
  } else {
    d.lastSeen = new Date().toISOString();
    if (parsed.data.name) d.name = parsed.data.name;
    if (parsed.data.screen) d.screen = parsed.data.screen;
  }
  persist();
  return ok(res, { code: d.code, status: d.status });
});

// GET /api/device/status?uuid= → {status}
app.get("/api/device/status", async (req, res) => {
  const uuid = String(req.query.uuid || "");
  if (!uuid) return fail(res, "VALIDATION", "uuid required", 400);
  if (prisma) {
    try {
      const row = await prisma.device.findUnique({ where: { uuid } });
      if (row) return ok(res, { status: row.status, code: row.code, assignedSlug: row.assignedSlug || "" });
    } catch { /* fallthrough */ }
  }
  const d = devicesMem.find((x) => x.uuid === uuid);
  if (!d) return fail(res, "NOT_FOUND", "미등록 장비", 404);
  return ok(res, { status: d.status, code: d.code, assignedSlug: d.assignedSlug || "" });
});

// POST /api/device/heartbeat {uuid, screen?, storagePct?}
app.post("/api/device/heartbeat", async (req, res) => {
  const parsed = z.object({
    uuid: z.string().min(1).max(100),
    screen: z.string().max(20).optional(),
    storagePct: z.number().int().min(0).max(100).optional()
  }).safeParse(req.body || {});
  if (!parsed.success) return fail(res, "VALIDATION", "uuid required", 400);
  const { uuid, screen, storagePct } = parsed.data;
  if (prisma) {
    try {
      const data = { lastSeen: new Date() };
      if (screen) data.screen = screen;
      if (storagePct !== undefined) data.storagePct = storagePct;
      await prisma.device.update({ where: { uuid }, data });
      return ok(res, null);
    } catch { /* fallthrough */ }
  }
  const d = devicesMem.find((x) => x.uuid === uuid);
  if (d) {
    d.lastSeen = new Date().toISOString();
    if (screen) d.screen = screen;
    if (storagePct !== undefined) d.storagePct = storagePct;
    persist();
  }
  return ok(res, null);
});

// ----- Admin: devices -----
app.get("/api/admin/devices", requireAdmin, async (req, res) => {
  if (prisma) {
    try {
      const rows = await prisma.device.findMany({ orderBy: { createdAt: "desc" } });
      return ok(res, rows);
    } catch { /* fallthrough */ }
  }
  return ok(res, devicesMem);
});

app.patch("/api/admin/devices", requireAdmin, async (req, res) => {
  const parsed = z.object({
    uuid: z.string().min(1),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    name: z.string().max(100).optional(),
    assignedSlug: z.string().max(50).optional(),
    placement: z.string().max(100).optional(),
    screen: z.string().max(20).optional()
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  if (prisma) {
    try {
      const data = {};
      if (parsed.data.status) data.status = parsed.data.status;
      if (parsed.data.name !== undefined) data.name = parsed.data.name;
      if (parsed.data.assignedSlug !== undefined) data.assignedSlug = parsed.data.assignedSlug;
      if (parsed.data.placement !== undefined) data.placement = parsed.data.placement;
      if (parsed.data.screen !== undefined) data.screen = parsed.data.screen;
      const row = await prisma.device.update({ where: { uuid: parsed.data.uuid }, data });
      await audit(req.claims.userId, "device.update", parsed.data.uuid, "success");
      return ok(res, row);
    } catch {
      return fail(res, "NOT_FOUND", "장비 없음", 404);
    }
  }
  const d = devicesMem.find((x) => x.uuid === parsed.data.uuid);
  if (!d) return fail(res, "NOT_FOUND", "장비 없음", 404);
  if (parsed.data.status) d.status = parsed.data.status;
  if (parsed.data.name !== undefined) d.name = parsed.data.name;
  if (parsed.data.assignedSlug !== undefined) d.assignedSlug = parsed.data.assignedSlug;
  if (parsed.data.placement !== undefined) d.placement = parsed.data.placement;
  if (parsed.data.screen !== undefined) d.screen = parsed.data.screen;
  persist();
  await audit(req.claims.userId, "device.update", d.uuid, "success");
  return ok(res, d);
});

// POST /api/admin/devices {uuid?, name?, placement?} — 사전 등록(수동 생성)
app.post("/api/admin/devices", requireAdmin, async (req, res) => {
  const parsed = z.object({
    uuid: z.string().min(8).max(100).optional(),
    name: z.string().max(100).optional(),
    placement: z.string().max(100).optional()
  }).safeParse(req.body || {});
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  const uuid = parsed.data.uuid || `rk-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  if (prisma) {
    try {
      const row = await prisma.device.create({
        data: { uuid, name: parsed.data.name || "미지정 장비", code: deviceCode(), status: "pending", placement: parsed.data.placement || "" }
      });
      await audit(req.claims.userId, "device.create", uuid, "success");
      return ok(res, row, 201);
    } catch {
      return fail(res, "CONFLICT", "UUID 중복", 409);
    }
  }
  if (devicesMem.some((x) => x.uuid === uuid)) return fail(res, "CONFLICT", "UUID 중복", 409);
  const row = { id: `d-${Date.now()}`, uuid, name: parsed.data.name || "미지정 장비", code: deviceCode(), status: "pending", screen: "", placement: parsed.data.placement || "", storagePct: -1, assignedSlug: "", lastSeen: new Date(0).toISOString(), createdAt: new Date().toISOString() };
  devicesMem.push(row);
  persist();
  await audit(req.claims.userId, "device.create", uuid, "success");
  return ok(res, row, 201);
});

app.delete("/api/admin/devices", requireAdmin, async (req, res) => {  const { uuid } = req.query;
  if (!uuid) return fail(res, "VALIDATION", "uuid required", 400);
  if (prisma) {
    try {
      await prisma.device.delete({ where: { uuid: String(uuid) } });
    } catch { /* ignore */ }
  }
  devicesMem = devicesMem.filter((x) => x.uuid !== String(uuid));
  persist();
  await audit(req.claims.userId, "device.delete", String(uuid), "success");
  return ok(res, null);
});

// ----- 데이터셋 (엑셀/CSV 일괄등록 → 컴포넌트 바인딩용) -----
// datasetsMem: {id, name, columns: string[], rows: Record[], createdAt}
// (let datasetsMem은 상단 선언부에서 초기화 — TDZ 방지)
function parseDataset(filename, buf) {
  const XLSX = require("xlsx");
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = buf.toString("utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { columns: [], rows: [] };
    const split = (l) => l.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    const columns = split(lines[0]);
    const rows = lines.slice(1, 501).map((l) => {
      const v = split(l);
      const o = {};
      columns.forEach((c, i) => { o[c] = v[i] ?? ""; });
      return o;
    });
    return { columns, rows };
  }
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!arr.length) return { columns: [], rows: [] };
  const columns = arr[0].map((c) => String(c));
  const rows = arr.slice(1, 501).map((r) => {
    const o = {};
    columns.forEach((c, i) => { o[c] = r[i]; });
    return o;
  });
  return { columns, rows };
}

// POST /api/admin/datasets/upload {name, filename, dataUrl} — ADMIN (.xlsx/.csv, 3MB)
app.post("/api/admin/datasets/upload", requireAdmin, async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1, "이름을 입력하세요").max(100),
    filename: z.string().min(1).max(100),
    dataUrl: z.string().min(1).max(6_000_000)
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  if (!/\.(xlsx|csv)$/i.test(parsed.data.filename)) return fail(res, "VALIDATION", ".xlsx/.csv만 허용", 400);
  const m = parsed.data.dataUrl.match(/^data:[a-z/+.-]+;base64,(.+)$/);
  if (!m) return fail(res, "VALIDATION", "dataUrl 형식 오류", 400);
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > 3_000_000) return fail(res, "VALIDATION", "3MB 이하만 허용", 400);
  let ds;
  try {
    ds = parseDataset(parsed.data.filename, buf);
  } catch {
    return fail(res, "VALIDATION", "파일 파싱 실패", 400);
  }
  const row = { id: `ds-${Date.now()}`, name: parsed.data.name, columns: ds.columns, rows: ds.rows, createdAt: new Date().toISOString() };
  datasetsMem.push(row);
  persist();
  await audit(req.claims.userId, "dataset.upload", row.name, "success");
  return ok(res, { ...row, rows: row.rows.slice(0, 5), total: row.rows.length }, 201);
});

// GET /api/admin/datasets — ADMIN (rows는 5개 미리보기 + total)
app.get("/api/admin/datasets", requireAdmin, async (req, res) => {
  return ok(res, datasetsMem.map((d) => ({ ...d, rows: d.rows.slice(0, 5), total: d.rows.length })));
});

// GET /api/datasets/:id — 공개 렌더용 (전체 행, no-store)
app.get("/api/datasets/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const d = datasetsMem.find((x) => x.id === req.params.id);
  if (!d) return fail(res, "NOT_FOUND", "데이터셋 없음", 404);
  return ok(res, d);
});

// DELETE /api/admin/datasets?id= — ADMIN
app.delete("/api/admin/datasets", requireAdmin, async (req, res) => {
  const { id } = req.query;
  datasetsMem = datasetsMem.filter((x) => x.id !== String(id));
  persist();
  await audit(req.claims.userId, "dataset.delete", String(id), "success");
  return ok(res, null);
});

// ----- 템플릿 (키오스크 화면 에디터용 JSON) -----
// Template {id, slug, name, category, status: draft|published, version, pages, completePageId, updatedAt}
// Page {id, title, components: [{id, type: text|button|image|video|nav, props}]}
// 버전 롤백: versions 배열에 게시 스냅샷 보관 (최대 20)
function templatePublic(t) {
  const { pages, ...rest } = t;
  return { ...rest, pageCount: (pages || []).length };
}
function toAppRow(t) {
  return {
    id: `tpl-${t.id}`, name: t.name, slug: `t-${t.slug}`, targetUrl: `/t/${t.slug}`,
    iconUrl: "/icons/app.svg", description: `템플릿 v${t.version}`, displayOrder: 900,
    isActive: true, category: t.category || "전체", openMode: "embed", links: []
  };
}

// 명도 대비율 (WCAG)
function luminance(hex) {
  const c = hex.replace("#", "");
  const v = [0, 2, 4].map((i) => {
    const x = parseInt(c.substr(i, 2), 16) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contrastRatio(a, b) {
  try {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  } catch { return 0; }
}
// 접근성 게이트: 게시 전 자동 검증 (차단: errors, 경고: warnings)
function validateTemplate(t) {
  const errors = [], warnings = [];
  if (!t.pages || !t.pages.length) errors.push({ message: "페이지가 없습니다" });
  for (const p of t.pages || []) {
    for (const c of p.components || []) {
      const pr = c.props || {};
      if (c.type === "button") {
        const w = Number(pr.width || 0), h = Number(pr.height || 0);
        if ((w && w < 48) || (h && h < 48)) errors.push({ page: p.title, message: `버튼 "${pr.label || c.id}" 터치 영역 48px 미만` });
        if (pr.bg && pr.color && contrastRatio(pr.bg, pr.color) < 4.5) errors.push({ page: p.title, message: `버튼 "${pr.label || c.id}" 명도 대비 4.5:1 미만` });
        if (!pr.tts) warnings.push({ page: p.title, message: `버튼 "${pr.label || c.id}" TTS 안내 없음` });
      }
      if (c.type === "text") {
        if (pr.bg && pr.color && contrastRatio(pr.bg, pr.color) < 4.5) errors.push({ page: p.title, message: `텍스트 명도 대비 4.5:1 미만` });
      }
    }
  }
  return { passed: errors.length === 0, errors, warnings };
}

const TemplateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자·숫자·하이픈만").optional(),
  name: z.string().min(1, "이름을 입력하세요").max(100).optional(),
  category: z.string().max(50).optional(),
  industry: z.string().max(30).optional(),
  tags: z.string().max(200).optional(),
  runMode: z.enum(["live", "demo"]).optional(),
  pages: z.array(z.object({
    id: z.string().min(1), title: z.string().max(100),
    components: z.array(z.object({ id: z.string().min(1), type: z.enum(["text", "button", "image", "video", "nav", "appbar", "progress", "ticker", "quiz", "survey", "numpad", "productgrid", "html"]), props: z.record(z.any()).default({}) })).default([])
  })).max(30).optional(),
  completePageId: z.string().max(100).nullable().optional()
});

// GET /api/admin/templates (전체) — ADMIN
app.get("/api/admin/templates", requireAdmin, async (req, res) => {
  if (prisma) {
    try {
      const rows = await prisma.template.findMany({ orderBy: { updatedAt: "desc" } });
      return ok(res, rows.map((r) => templatePublic({ ...r, pages: JSON.parse(r.body) })));
    } catch { /* fallthrough */ }
  }
  return ok(res, templatesMem.map(templatePublic));
});

// POST /api/admin/templates {name, slug?, category?} — ADMIN
app.post("/api/admin/templates", requireAdmin, async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1, "이름을 입력하세요").max(100),
    slug: z.string().regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자·숫자·하이픈만").optional(),
    category: z.string().max(50).optional()
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  const valid = await validCategories();
  const category = parsed.data.category || "전체";
  if (!valid.includes(category)) return fail(res, "VALIDATION", `카테고리는 다음 중 선택: ${valid.join(", ")}`, 400);
  const slug = parsed.data.slug || `tpl-${Date.now().toString(36)}`;
  if (prisma) {
    try {
      const row = await prisma.template.create({
        data: { slug, name: parsed.data.name, category, status: "draft", version: 0, body: JSON.stringify({ pages: [], completePageId: null }) }
      });
      await audit(req.claims.userId, "template.create", slug, "success");
      return ok(res, templatePublic({ ...row, pages: [] }), 201);
    } catch {
      return fail(res, "CONFLICT", "슬러그 중복", 409);
    }
  }
  if (templatesMem.some((t) => t.slug === slug)) return fail(res, "CONFLICT", "슬러그 중복", 409);
  const row = { id: `t-${Date.now()}`, slug, name: parsed.data.name, category, status: "draft", version: 0, pages: [], completePageId: null, versions: [], updatedAt: new Date().toISOString() };
  templatesMem.push(row);
  persist();
  await audit(req.claims.userId, "template.create", slug, "success");
  return ok(res, templatePublic(row), 201);
});

// PATCH /api/admin/templates {id, name?, category?, pages?, completePageId?} — ADMIN (초안 저장)
app.patch("/api/admin/templates", requireAdmin, async (req, res) => {
  const parsed = TemplateSchema.extend({ id: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  const { id, ...data } = parsed.data;
  if (data.category) {
    const valid = await validCategories();
    if (!valid.includes(data.category)) return fail(res, "VALIDATION", `카테고리는 다음 중 선택: ${valid.join(", ")}`, 400);
  }
  const applyMem = () => {
    const t = templatesMem.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, data, { updatedAt: new Date().toISOString() });
    persist();
    return t;
  };
  if (prisma) {
    try {
      const dbData = { ...data };
      if (dbData.pages) { dbData.body = JSON.stringify({ pages: dbData.pages, completePageId: dbData.completePageId ?? undefined }); delete dbData.pages; delete dbData.completePageId; }
      const row = await prisma.template.update({ where: { id }, data: dbData });
      await audit(req.claims.userId, "template.update", row.slug, "success");
      const full = { ...row, ...(JSON.parse(row.body || '{"pages":[]}')) };
      return ok(res, templatePublic(full));
    } catch { /* fallthrough to mem */ }
  }
  const t = applyMem();
  if (!t) return fail(res, "NOT_FOUND", "템플릿 없음", 404);
  await audit(req.claims.userId, "template.update", t.slug, "success");
  return ok(res, templatePublic(t));
});

// POST /api/admin/templates/publish {id} — 접근성 게이트 통과 시 게시 + 버전 기록
app.post("/api/admin/templates/publish", requireAdmin, async (req, res) => {
  const { id } = req.body || {};
  const find = async () => {
    if (prisma) {
      try {
        const row = await prisma.template.findUnique({ where: { id } });
        if (row) return { ...row, ...(JSON.parse(row.body || '{"pages":[]}')) };
      } catch { /* fallthrough */ }
    }
    return templatesMem.find((x) => x.id === id);
  };
  const t = await find();
  if (!t) return fail(res, "NOT_FOUND", "템플릿 없음", 404);
  const v = validateTemplate(t);
  if (!v.passed) return fail(res, "A11Y", `접근성 미달: ${v.errors.map((e) => e.message).join("; ")}`, 422);
  t.version = (t.version || 0) + 1;
  t.status = "published";
  t.updatedAt = new Date().toISOString();
  const snap = JSON.parse(JSON.stringify({ version: t.version, pages: t.pages, completePageId: t.completePageId, at: t.updatedAt }));
  if (prisma) {
    try {
      await prisma.template.update({ where: { id }, data: { status: "published", version: t.version, body: JSON.stringify({ pages: t.pages, completePageId: t.completePageId }) } });
      await prisma.templateVersion.create({ data: { templateId: id, version: t.version, body: JSON.stringify(snap) } });
      const vers = await prisma.templateVersion.findMany({ where: { templateId: id }, orderBy: { version: "desc" }, take: 20 });
      await audit(req.claims.userId, "template.publish", `${t.slug}@v${t.version}`, "success");
      return ok(res, { ...templatePublic(t), warnings: v.warnings, versions: vers.map((x) => x.version) });
    } catch { /* fallthrough */ }
  }
  t.versions = t.versions || [];
  t.versions.unshift(snap);
  t.versions = t.versions.slice(0, 20);
  persist();
  await audit(req.claims.userId, "template.publish", `${t.slug}@v${t.version}`, "success");
  return ok(res, { ...templatePublic(t), warnings: v.warnings, versions: t.versions.map((x) => x.version) });
});

// POST /api/admin/templates/stage {id} — 검수용 스테이징 (게이트 없이, /t/슬러그에서만 확인, 런처 미노출)
app.post("/api/admin/templates/stage", requireAdmin, async (req, res) => {
  const { id } = req.body || {};
  if (prisma) {
    try {
      const row = await prisma.template.update({ where: { id }, data: { status: "review" } });
      await audit(req.claims.userId, "template.stage", row.slug, "success");
      return ok(res, { status: "review" });
    } catch { return fail(res, "NOT_FOUND", "템플릿 없음", 404); }
  }
  const t = templatesMem.find((x) => x.id === id);
  if (!t) return fail(res, "NOT_FOUND", "템플릿 없음", 404);
  t.status = "review";
  t.updatedAt = new Date().toISOString();
  persist();
  await audit(req.claims.userId, "template.stage", t.slug, "success");
  return ok(res, { status: "review" });
});
app.post("/api/admin/templates/rollback", requireAdmin, async (req, res) => {
  const { id, version } = req.body || {};
  if (prisma) {
    try {
      const ver = await prisma.templateVersion.findFirst({ where: { templateId: id, version: Number(version) } });
      if (!ver) return fail(res, "NOT_FOUND", "버전 없음", 404);
      const snap = JSON.parse(ver.body);
      await prisma.template.update({ where: { id }, data: { status: "published", body: JSON.stringify({ pages: snap.pages, completePageId: snap.completePageId }) } });
      await audit(req.claims.userId, "template.rollback", `${id}@v${version}`, "success");
      return ok(res, { rolledBack: Number(version) });
    } catch { /* fallthrough */ }
  }
  const t = templatesMem.find((x) => x.id === id);
  const snap = t && (t.versions || []).find((x) => x.version === Number(version));
  if (!snap) return fail(res, "NOT_FOUND", "버전 없음", 404);
  t.pages = JSON.parse(JSON.stringify(snap.pages));
  t.completePageId = snap.completePageId;
  t.status = "published";
  t.updatedAt = new Date().toISOString();
  persist();
  await audit(req.claims.userId, "template.rollback", `${t.slug}@v${version}`, "success");
  return ok(res, { rolledBack: Number(version) });
});

// POST /api/admin/templates/unpublish {id} — 게시 취소 (버전 유지)
app.post("/api/admin/templates/unpublish", requireAdmin, async (req, res) => {
  const { id } = req.body || {};
  if (prisma) {
    try {
      const row = await prisma.template.update({ where: { id }, data: { status: "draft" } });
      await audit(req.claims.userId, "template.unpublish", row.slug, "success");
      return ok(res, { status: "draft" });
    } catch { return fail(res, "NOT_FOUND", "템플릿 없음", 404); }
  }
  const t = templatesMem.find((x) => x.id === id);
  if (!t) return fail(res, "NOT_FOUND", "템플릿 없음", 404);
  t.status = "draft";
  t.updatedAt = new Date().toISOString();
  persist();
  await audit(req.claims.userId, "template.unpublish", t.slug, "success");
  return ok(res, { status: "draft" });
});
app.delete("/api/admin/templates", requireAdmin, async (req, res) => {
  const { id } = req.query;
  if (!id) return fail(res, "VALIDATION", "id required", 400);
  if (prisma) {
    try {
      const row = await prisma.template.findUnique({ where: { id: String(id) } });
      await prisma.template.delete({ where: { id: String(id) } });
      await audit(req.claims.userId, "template.delete", row ? row.slug : String(id), "success");
      return ok(res, null);
    } catch { /* fallthrough */ }
  }
  const t = templatesMem.find((x) => x.id === String(id));
  templatesMem = templatesMem.filter((x) => x.id !== String(id));
  persist();
  await audit(req.claims.userId, "template.delete", t ? t.slug : String(id), "success");
  return ok(res, null);
});

// GET /api/templates/:slug — 공개 렌더용 (게시 + 검수중; 초안은 404)
app.get("/api/templates/:slug", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const find = async () => {
    if (prisma) {
      try {
        const row = await prisma.template.findUnique({ where: { slug: req.params.slug } });
        if (row && (row.status === "published" || row.status === "review")) return { ...row, ...(JSON.parse(row.body || '{"pages":[]}')) };
      } catch { /* fallthrough */ }
    }
    return templatesMem.find((x) => x.slug === req.params.slug && (x.status === "published" || x.status === "review"));
  };
  const t = await find();
  if (!t) return fail(res, "NOT_FOUND", "게시된 템플릿 없음", 404);
  return ok(res, t);
});

// ----- 텔레메트리 (현황 대시보드용) -----
// eventsMem: {id, deviceUuid, appSlug, type: APP_START|APP_COMPLETE|ERROR, at}
// POST /api/device/events {uuid, events: [{appSlug, type, at?}]} (최대 50건)
app.post("/api/device/events", async (req, res) => {
  const parsed = z.object({
    uuid: z.string().min(1).max(100),
    events: z.array(z.object({
      appSlug: z.string().max(100),
      type: z.enum(["APP_START", "APP_COMPLETE", "ERROR", "SURVEY"]),
      at: z.string().max(30).optional(),
      payload: z.record(z.any()).optional()
    })).max(50)
  }).safeParse(req.body);
  if (!parsed.success) return fail(res, "VALIDATION", zMsg(parsed), 400);
  // 분당 60건 rate limit (어뷰징 방지)
  if (!checkLimit(`ev:${parsed.data.uuid}`, 60, 60000)) return fail(res, "RATE_LIMIT", "Too many events", 429);
  // 승인제 토글: 승인된 장비만 수집
  const s = await getSettings();
  if (s.requireApprovedDevice) {
    let approved = false;
    if (prisma) {
      try {
        const d = await prisma.device.findUnique({ where: { uuid: parsed.data.uuid } });
        approved = !!d && d.status === "approved";
      } catch { /* fallthrough */ }
    } else {
      const d = devicesMem.find((x) => x.uuid === parsed.data.uuid);
      approved = !!d && d.status === "approved";
    }
    if (!approved) return fail(res, "FORBIDDEN", "미승인 장비", 403);
  }
  const rows = parsed.data.events.map((e) => ({
    id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    deviceUuid: parsed.data.uuid, appSlug: e.appSlug, type: e.type,
    payload: e.payload || null,
    at: e.at || new Date().toISOString()
  }));
  if (prisma) {
    try {
      await prisma.appEvent.createMany({ data: rows });
      return ok(res, { received: rows.length });
    } catch { /* fallthrough */ }
  }
  eventsMem.push(...rows);
  eventsMem = eventsMem.slice(-5000);
  return ok(res, { received: rows.length });
});

// GET /api/admin/stats?days=7 — ADMIN (일별 이용·완료, 앱별 완료율, 기기별)
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 7), 1), 90);
  const since = new Date(Date.now() - days * 86400000);
  let events = [];
  if (prisma) {
    try {
      events = await prisma.appEvent.findMany({ where: { at: { gte: since } }, orderBy: { at: "asc" }, take: 5000 });
    } catch { events = eventsMem.filter((e) => new Date(e.at) >= since); }
  } else {
    events = eventsMem.filter((e) => new Date(e.at) >= since);
  }
  const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);
  const perDayMap = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    perDayMap.set(d, { date: d, starts: 0, completes: 0, surveys: 0 });
  }
  const perAppMap = new Map();
  const perDeviceMap = new Map();
  const surveyMap = new Map();
  const recentErrors = [];
  let errors = 0;
  let surveys = 0;
  for (const e of events) {
    const dk = dayKey(e.at);
    if (perDayMap.has(dk)) {
      if (e.type === "APP_START") perDayMap.get(dk).starts++;
      if (e.type === "APP_COMPLETE") perDayMap.get(dk).completes++;
      if (e.type === "SURVEY") { perDayMap.get(dk).surveys++; surveys++; }
    }
    if (!perAppMap.has(e.appSlug)) perAppMap.set(e.appSlug, { slug: e.appSlug, starts: 0, completes: 0, surveys: 0 });
    if (e.type === "APP_START") perAppMap.get(e.appSlug).starts++;
    if (e.type === "APP_COMPLETE") perAppMap.get(e.appSlug).completes++;
    if (e.type === "SURVEY") {
      perAppMap.get(e.appSlug).surveys++;
      const q = (e.payload && e.payload.question) || e.appSlug;
      const key = `${e.appSlug}|||${q}`;
      if (!surveyMap.has(key)) surveyMap.set(key, { appSlug: e.appSlug, question: String(q).slice(0, 80), c5: 0, c3: 0, c1: 0, n: 0 });
      const sc = Number(e.payload && e.payload.score);
      const row = surveyMap.get(key);
      row.n++;
      if (sc === 5) row.c5++; else if (sc === 3) row.c3++; else if (sc === 1) row.c1++;
    }
    if (e.type === "ERROR") {
      errors++;
      if (recentErrors.length < 20) recentErrors.unshift({ deviceUuid: e.deviceUuid, appSlug: e.appSlug, at: e.at, payload: e.payload || null });
    }
    if (!perDeviceMap.has(e.deviceUuid)) perDeviceMap.set(e.deviceUuid, { uuid: e.deviceUuid, starts: 0, completes: 0 });
    if (e.type === "APP_START") perDeviceMap.get(e.deviceUuid).starts++;
    if (e.type === "APP_COMPLETE") perDeviceMap.get(e.deviceUuid).completes++;
  }
  const perApp = [...perAppMap.values()].map((a) => ({ ...a, rate: a.starts ? Math.round((a.completes / a.starts) * 100) : 0 }));
  const surveyDetail = [...surveyMap.values()].map((r) => ({
    ...r, avg: r.n ? Math.round(((r.c5 * 5 + r.c3 * 3 + r.c1 * 1) / r.n) * 10) / 10 : 0
  }));
  return ok(res, { perDay: [...perDayMap.values()], perApp, perDevice: [...perDeviceMap.values()], errors, surveys, surveyDetail, recentErrors });
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
  requireApprovedDevice: z.boolean().optional(),
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
