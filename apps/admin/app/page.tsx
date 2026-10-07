"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PreviewGrid, type AppRegistry } from "@/components/PreviewGrid";

function PvHtml({ html }: { html: string }) {
  const clean = useMemo(() => html, [html]);
  if (clean.length > 500000) return <div>HTML이 너무 큽니다 (50만자 이하)</div>;
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

const LAUNCHER = process.env.NEXT_PUBLIC_LAUNCHER_URL || "/";
type Tab = string;

const DEFAULT_MENU = [
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

interface AuditRow { id: string; actorId: string; action: string; target?: string | null; result: string; createdAt: string; }
interface Perm { email: string; slug: string; accessLevel: string; }
interface Settings { platformName: string; primaryColor: string; logoUrl: string; announcement: string; idleTimeoutMin: number; menuOrder: string[]; backgroundType: string; backgroundColor: string; backgroundImage: string; allowedDomains: string[]; gridDensity: string; gridCols: { mobile: number; tablet: number; desktop: number; kiosk: number }; showAppName: boolean; pwaIconUrl: string; adminMenu: { id: string; label: string }[]; requireApprovedDevice: boolean; notification?: { webhookUrl?: string }; }
interface TplList { id: string; slug: string; name: string; category?: string; status: string; version: number; pageCount: number; updatedAt: string; }
interface TplFull extends TplList { pages: TplPage[]; completePageId?: string | null; versions?: (number | { version: number })[]; warnings?: { message: string }[]; industry?: string; tags?: string; runMode?: string; }
interface DsList { id: string; name: string; columns: string[]; total: number; }
interface TplPage { id: string; title: string; bg?: string; bgImage?: string; components: TplComp[]; }
interface TplComp { id: string; type: string; props: Record<string, unknown>; }
interface StatRow { slug?: string; uuid?: string; date?: string; starts: number; completes: number; rate?: number; }
interface Stats { perDay: StatRow[]; perApp: StatRow[]; perDevice: StatRow[]; errors: number; surveys?: number; surveyDetail?: { appSlug: string; question: string; c5: number; c3: number; c1: number; n: number; avg: number }[]; recentErrors?: { deviceUuid: string; appSlug: string; at: string }[]; }
interface AppUser { id: string; email: string; role: string; createdAt: string; }
interface Device { id: string; uuid: string; name: string; code: string; status: string; lastSeen: string; createdAt: string; assignedSlug?: string; screen?: string; placement?: string; storagePct?: number; }

const EMPTY_APP: { name: string; slug: string; targetUrl: string; iconUrl: string; description: string; category: string; openMode: "embed" | "direct"; bgType: string; bgColor: string; bgImage: string } = { name: "", slug: "", targetUrl: "", iconUrl: "/icons/app.svg", description: "", category: "전체", openMode: "embed", bgType: "color", bgColor: "#FFFFFF", bgImage: "" };

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [apps, setApps] = useState<AppRegistry[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [settings, setSettings] = useState<Settings>({ platformName: "", primaryColor: "#C2410C", logoUrl: "/logo.svg", announcement: "", idleTimeoutMin: 3, menuOrder: [], backgroundType: "color", backgroundColor: "#FFF7ED", backgroundImage: "", allowedDomains: [], gridDensity: "comfortable", gridCols: { mobile: 2, tablet: 3, desktop: 4, kiosk: 5 }, showAppName: true, pwaIconUrl: "", adminMenu: [], requireApprovedDevice: false, notification: { webhookUrl: "" } });
  const [newDomain, setNewDomain] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tpls, setTpls] = useState<TplList[]>([]);
  const [tpl, setTpl] = useState<TplFull | null>(null);
  const [tplPage, setTplPage] = useState(0);
  const [newTpl, setNewTpl] = useState({ name: "", slug: "", category: "전체" });
  const [stats, setStats] = useState<Stats | null>(null);
  const [statDays, setStatDays] = useState(7);
  const [dss, setDss] = useState<DsList[]>([]);
  const [drvs, setDrvs] = useState<{ id: string; name: string; type: string; mode: string }[]>([]);
  const [newDrv, setNewDrv] = useState({ name: "", type: "printer", mode: "simulation" });
  const [sched, setSched] = useState<{ uuid: string; rows: { from: string; to: string; target: string }[] } | null>(null);
  const [outbox, setOutbox] = useState<{ id: string; kind: string; text: string; at: string; sent?: boolean }[]>([]);
  const [newNotif, setNewNotif] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<string | null>(null);
  const [previewW, setPreviewW] = useState(390);
  const [pvIdx, setPvIdx] = useState(0);
  const [selComp, setSelComp] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState("");

  // 자동 저장 (2초 디바운스) — 저장 누락 방지
  useEffect(() => {
    if (!tpl || !tpl.id) return;
    const t = setTimeout(async () => {
      const r = await fetch("/api/admin/templates", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: tpl.id, name: tpl.name, category: tpl.category, industry: tpl.industry || "", tags: tpl.tags || "", runMode: tpl.runMode || "live", pages: tpl.pages, completePageId: tpl.completePageId ?? null })
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) {
        setAutoSaved(new Date().toLocaleTimeString("ko-KR"));
        load();
      } else {
        notify(j.error?.message ?? "자동 저장 실패", false);
      }
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl ? JSON.stringify([tpl.name, tpl.category, tpl.pages, tpl.completePageId, tpl.industry, tpl.tags, tpl.runMode]) : ""] as unknown as [string]);

  function addComp(type: string) {
    if (!tpl || tplPage >= tpl.pages.length) return;
    const id = `c${Date.now()}`;
    const defaults: Record<string, Record<string, unknown>> = {
      text: { content: "새 텍스트", size: 20, color: "#111111", align: "left", tts: "" },
      button: { label: "새 버튼", bg: "#C2410C", color: "#FFFFFF", size: 22, height: 64, target: "", tts: "", actions: [] },
      image: { src: "/logo.svg", alt: "", height: 0 },
      video: { src: "", subtitle: "" },
      nav: { label: "이동", target: "/" },
      appbar: { title: "제목", bg: "#0d9488", color: "#FFFFFF", size: 20 },
      progress: { label: "진행률", value: 30, max: 100, bg: "#0d9488" },
      ticker: { text: "공지사항", bg: "#111111", color: "#FFFFFF", size: 15 },
      quiz: { question: "질문", options: ["선택1", "선택2"], answer: 0 },
      survey: { question: "오늘 교육이 도움이 되셨나요?", appSlug: "" },
      numpad: { label: "숫자를 입력하세요", target: "" },
      productgrid: { datasetId: "", titleField: "이름", priceField: "가격", imageField: "이미지", columns: 2 },
      html: { html: "<div>HTML</div>" },
      calendar: {},
      weather: { label: "현재 날씨", lat: 37.56, lon: 126.97 },
      chart: { title: "차트", datasetId: "", labelField: "이름", valueField: "가격" },
      tabs: { items: ["탭1", "탭2"] },
      videolist: { urls: [] }
    };
    updPage(tpl.pages[tplPage].id, { components: [...tpl.pages[tplPage].components, { id, type, props: defaults[type] || {} }] });
    setSelComp(id);
  }
  const [newUser, setNewUser] = useState({ email: "", password: "", role: "USER" });
  const [newCat, setNewCat] = useState("");
  const [auditFilter, setAuditFilter] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string; ok: boolean } | null>(null);

  function notify(text: string, ok = true) {
    setToast({ id: Date.now(), text, ok });
  }
  function result(ok: boolean, okText: string, j: { error?: { message?: string } }, failDefault = "실패") {
    if (ok) notify(okText);
    else notify(j.error?.message ?? failDefault, false);
  }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const [form, setForm] = useState(EMPTY_APP);
  const [editing, setEditing] = useState<(AppRegistry & { id: string }) | null>(null);
  const [perm, setPerm] = useState({ email: "", slug: "", accessLevel: "VIEW" });
  const [rename, setRename] = useState({ from: "", to: "" });
  const [moveTo, setMoveTo] = useState("전체");
  const [uploading, setUploading] = useState(false);

  async function uploadIcon(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const r = await fetch("/api/admin/upload", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, dataUrl })
      });
      const j = await r.json();
      if (r.ok && j.success) { notify(`아이콘 업로드됨: ${j.data.url}`); return j.data.url as string; }
      notify(j.error?.message ?? "업로드 실패 (png/jpg/webp/svg, 1.5MB 이하)", false);
      return null;
    } catch {
      notify("업로드 실패", false);
      return null;
    } finally {
      setUploading(false);
    }
  }

  const load = () => {
    // 401(미인증)일 때만 로그인으로. 500·네트워크 오류(백엔드 재시작 순간)에는 유지.
    fetch("/api/auth/me").then(async (r) => {
      if (r.status === 401) router.replace("/login");
    }).catch(() => {});
    fetch("/api/admin/apps").then(async (r) => {
      const j = await r.json();
      if (r.ok && j.success) setApps(j.data);
      else if (r.status === 403) router.replace("/login");
    }).catch(() => {});
    fetch("/api/admin/permissions").then(async (r) => {
      const j = await r.json();
      if (j.success) setPerms(j.data);
    }).catch(() => {});
    fetch("/api/admin/audit?limit=50").then(async (r) => {
      const j = await r.json();
      if (j.success) setAudit(j.data);
    }).catch(() => {});
    fetch("/api/admin/settings").then(async (r) => {
      const j = await r.json();
      if (j.success && j.data) setSettings({
        platformName: j.data.platformName ?? "", primaryColor: j.data.primaryColor ?? "#C2410C",
        logoUrl: j.data.logoUrl ?? "/logo.svg", announcement: j.data.announcement ?? "",
        idleTimeoutMin: j.data.idleTimeoutMin ?? 3, menuOrder: j.data.menuOrder ?? [],
        backgroundType: j.data.backgroundType ?? "color",
        backgroundColor: j.data.backgroundColor ?? "#FFF7ED",
        backgroundImage: j.data.backgroundImage ?? "",
        allowedDomains: j.data.allowedDomains ?? [],
        gridDensity: j.data.gridDensity ?? "comfortable",
        gridCols: { mobile: 2, tablet: 3, desktop: 4, kiosk: 5, ...(j.data.gridCols || {}) },
        showAppName: j.data.showAppName !== false,
        pwaIconUrl: j.data.pwaIconUrl ?? "",
        adminMenu: Array.isArray(j.data.adminMenu) && j.data.adminMenu.length ? j.data.adminMenu : [],
        requireApprovedDevice: j.data.requireApprovedDevice === true,
        notification: j.data.notification || { webhookUrl: "" }
      });
    }).catch(() => {});
    fetch("/api/admin/users").then(async (r) => {
      const j = await r.json();
      if (j.success) setUsers(j.data);
    }).catch(() => {});
    fetch("/api/admin/devices").then(async (r) => {
      const j = await r.json();
      if (j.success) setDevices(j.data);
    }).catch(() => {});
    fetch("/api/admin/templates").then(async (r) => {
      const j = await r.json();
      if (j.success) setTpls(j.data);
    }).catch(() => {});
    fetch("/api/admin/datasets").then(async (r) => {
      const j = await r.json();
      if (j.success) setDss(j.data);
    }).catch(() => {});
    fetch("/api/admin/drivers").then(async (r) => {
      const j = await r.json();
      if (j.success) setDrvs(j.data);
    }).catch(() => {});
    fetch("/api/admin/outbox").then(async (r) => {
      const j = await r.json();
      if (j.success) setOutbox(j.data);
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  async function api(path: string, init?: RequestInit) {
    const r = await fetch(path, init);
    const j = await r.json().catch(() => ({ success: false, error: { message: r.statusText } }));
    return { ok: r.ok && j.success, j };
  }
  async function saveSettings(patch: Partial<Settings>, done = "설정 저장됨 → 런처에 반영") {
    // 변경분만 전송 (전체 병합 시 빈 값 검증 실패 방지)
    const body: Record<string, unknown> = { ...patch };
    if (body.idleTimeoutMin !== undefined) body.idleTimeoutMin = Number(body.idleTimeoutMin);
    const { ok, j } = await api("/api/admin/settings", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    setToast(ok ? { id: Date.now(), text: done, ok: true } : { id: Date.now(), text: j.error?.message ?? "실패", ok: false });
    if (ok) setSettings((s) => ({ ...s, ...patch }));
  }

  // 슬러그 자동 정규화: 소문자·공백→하이픈·허용문자만
  function normSlug(v: string) {
    return v.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const slug = normSlug(form.slug) || normSlug(form.name);
    const { ok, j } = await api("/api/admin/apps", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, slug, displayOrder: apps.length, isActive: true })
    });
    result(ok, "등록됨 → 런처에 즉시 반영", j);
    if (ok) { setForm(EMPTY_APP); load(); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const slug = normSlug(editing.slug);
    const { ok, j } = await api("/api/admin/apps", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: editing.id, name: editing.name, slug, targetUrl: editing.targetUrl, iconUrl: editing.iconUrl, description: editing.description, category: editing.category, stripPrefix: !!editing.stripPrefix, openMode: editing.openMode || "embed", openTarget: editing.openTarget || "self", bgType: editing.bgType || "color", bgColor: editing.bgColor || "#FFFFFF", bgImage: editing.bgImage || "", links: (editing.links || []).filter((l) => l.label.trim() && l.url.trim()) })
    });
    result(ok, "수정됨 → 런처에 즉시 반영", j);
    if (ok) { setEditing(null); load(); }
  }

  async function patch(id: string, data: Partial<AppRegistry>) {
    const { ok, j } = await api("/api/admin/apps", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    result(ok, "수정됨 → 런처에 즉시 반영", j);
    load();
  }

  async function remove(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    const r = await fetch(`/api/admin/apps?id=${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    result(r.ok && j.success, "삭제됨 → 런처에 즉시 반영", j);
    load();
  }

  async function move(id: string, dir: -1 | 1) {
    const sorted = [...apps].sort((a, b) => a.displayOrder - b.displayOrder);
    const i = sorted.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    await api("/api/admin/apps", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, displayOrder: sorted[j].displayOrder }) });
    await api("/api/admin/apps", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: sorted[j].id, displayOrder: sorted[i].displayOrder }) });
    load();
  }

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await api("/api/admin/permissions", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(perm)
    });
    result(ok, "권한 부여됨", j);
    if (ok) load();
  }

  async function revoke(email: string, slug: string) {
    if (!confirm(`${email} / ${slug} 권한을 회수할까요?`)) return;
    const r = await fetch(`/api/admin/permissions?email=${encodeURIComponent(email)}&slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    result(r.ok && j.success, "권한 회수됨", j);
    load();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await api("/api/admin/users", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(newUser)
    });
    result(ok, "사용자 생성됨", j);
    if (ok) { setNewUser({ email: "", password: "", role: "USER" }); load(); }
  }

  async function updateUser(id: string, data: { role?: string; password?: string }) {
    const { ok, j } = await api("/api/admin/users", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...data })
    });
    result(ok, "사용자 수정됨", j);
    if (ok) load();
  }

  async function setDevice(uuid: string, data: { status?: string; name?: string; assignedSlug?: string; placement?: string }, done = "장비 상태 변경됨") {
    const { ok, j } = await api("/api/admin/devices", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ uuid, ...data })
    });
    result(ok, done, j);
    if (ok) load();
  }

  async function removeDevice(uuid: string) {
    if (!confirm("장비를 삭제할까요?")) return;
    const r = await fetch(`/api/admin/devices?uuid=${encodeURIComponent(uuid)}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    result(r.ok && j.success, "장비 삭제됨", j);
    if (r.ok) load();
  }
  async function loadStats(days: number) {
    const r = await fetch(`/api/admin/stats?days=${days}`);
    const j = await r.json().catch(() => ({}));
    if (j.success) setStats(j.data);
  }

  async function createTpl(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await api("/api/admin/templates", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(newTpl)
    });
    result(ok, "템플릿 생성됨", j);
    if (ok) {
      setNewTpl({ name: "", slug: "", category: "전체" });
      const nid = (j.data as { id: string }).id;
      load();
      // 생성 후 바로 편집기 열기 (빈 화면 방지)
      setTimeout(() => openTplById(nid), 300);
    }
  }

  async function openTplById(id: string) {
    const r = await fetch("/api/admin/templates", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id })
    });
    const j = await r.json().catch(() => ({}));
    if (j.success && j.data) {
      const full = j.data as TplFull;
      setTpl({ ...full, pages: full.pages || [], completePageId: full.completePageId ?? null, versions: full.versions || [] });
      setTplPage(0);
      setPvIdx(0);
    }
  }

  async function openTpl(id: string) {
    await openTplById(id);
  }

  async function saveTpl(t: TplFull, msg = "템플릿 저장됨") {
    const { ok, j } = await api("/api/admin/templates", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, name: t.name, category: t.category, industry: t.industry || "", tags: t.tags || "", runMode: t.runMode || "live", pages: t.pages, completePageId: t.completePageId ?? null })
    });
    result(ok, msg, j);
    if (ok) { setTpl({ ...t }); load(); }
  }

  async function publishTpl(id: string) {
    const r = await fetch("/api/admin/templates/publish", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.success) {
      notify(`게시됨${(j.data?.warnings || []).length ? ` (경고 ${j.data.warnings.length}건)` : ""} → 런처·장비에 반영`);
      setTpl((cur) => cur && cur.id === id ? { ...cur, status: "published", version: j.data.version ?? cur.version, versions: j.data.versions ?? cur.versions } : cur);
      load();
    } else {
      notify(j.error?.message ?? "게시 실패", false);
    }
  }

  async function rollbackTpl(id: string, version: number) {
    if (!confirm(`v${version}으로 롤백할까요?`)) return;
    const r = await fetch("/api/admin/templates/rollback", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, version })
    });
    const j = await r.json().catch(() => ({}));
    result(r.ok && j.success, `v${version}으로 롤백됨`, j);
    if (r.ok) { setTpl(null); load(); }
  }

  async function removeTpl(id: string) {
    if (!confirm("템플릿을 삭제할까요?")) return;
    const r = await fetch(`/api/admin/templates?id=${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    result(r.ok && j.success, "템플릿 삭제됨", j);
    if (r.ok) { setTpl(null); load(); }
  }

  function updTpl(patch: Partial<TplFull>) {
    setTpl((cur) => (cur ? { ...cur, ...patch } : cur));
  }
  function updPage(pageId: string, patch: Partial<TplPage>) {
    setTpl((cur) => (cur ? { ...cur, pages: cur.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) } : cur));
  }
  function updComp(pageId: string, compId: string, props: Record<string, unknown>) {
    setTpl((cur) => (cur ? {
      ...cur,
      pages: cur.pages.map((p) => (p.id === pageId
        ? { ...p, components: p.components.map((c) => (c.id === compId ? { ...c, props: { ...c.props, ...props } } : c)) }
        : p))
    } : cur));
  }
  async function removeUser(id: string, email: string) {
    if (!confirm(`${email} 사용자를 삭제할까요?`)) return;
    const r = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    result(r.ok && j.success, "사용자 삭제됨", j);
    load();
  }

  async function createCat(e: React.FormEvent) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    const order = settings.menuOrder.includes(name) ? settings.menuOrder : [...settings.menuOrder, ...cats.filter((c) => !settings.menuOrder.includes(c)), name];
    saveSettings({ menuOrder: order }, `카테고리 "${name}" 생성됨 → 런처 메뉴에 반영`);
    setNewCat("");
  }

  async function renameCat(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await api("/api/admin/categories", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(rename)
    });
    result(ok, `카테고리 변경됨 (${j.data?.renamed ?? 0}개 앱)`, j);
    if (ok) { setRename({ from: "", to: "" }); load(); }
  }

  async function deleteCat(name: string) {
    if (!confirm(`카테고리 "${name}" 삭제 — 소속 앱은 "${moveTo}"로 이동합니다. 계속할까요?`)) return;
    const { ok, j } = await api(`/api/admin/categories?from=${encodeURIComponent(name)}&moveTo=${encodeURIComponent(moveTo)}`, { method: "DELETE" });
    result(ok, `삭제됨 (${j.data?.moved ?? 0}개 앱 이동)`, j);
    if (ok) load();
  }

  async function menuMove(name: string, dir: -1 | 1) {
    const order = settings.menuOrder.length ? [...settings.menuOrder] : cats;
    if (!order.includes(name)) order.push(name);
    const i = order.indexOf(name);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    saveSettings({ menuOrder: order }, "메뉴 순서 저장됨 → 런처 탭 순서에 반영");
  }

  const cats = Array.from(new Set(apps.map((a) => a.category || "전체")));
  // 메뉴 우선: 선택 후보 = 전체 + 메뉴순서 + 사용 중 (중복 제거)
  const catOptions = ["전체", ...Array.from(new Set([...settings.menuOrder, ...cats])).filter((c) => c !== "전체")];
  // 표시용 메뉴: 메뉴순서 우선, 그 외 사용 중 카테고리 뒤에 (빈 카테고리도 표시)
  const menuCats = [...settings.menuOrder.filter((c) => c !== "전체"), ...cats.filter((c) => c !== "전체" && !settings.menuOrder.includes(c))];
  const showCats = ["전체", ...menuCats];
  const input = "min-h-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)] bg-white";
  const btn = "min-h-[48px] min-w-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)] bg-white";
  const primary = "min-h-[48px] rounded-lg bg-gray-900 text-white px-4 text-[clamp(16px,2vw,24px)]";
  const menu = settings.adminMenu.length ? settings.adminMenu : DEFAULT_MENU;
  const mainTabs: { id: string; label: string }[] = menu.slice(0, 3);
  const moreTabs: { id: string; label: string }[] = menu.slice(3);
  const tabs = [...mainTabs, ...moreTabs];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <aside className="hidden md:flex md:w-[280px] shrink-0 bg-gray-900 text-white p-4 md:flex-col gap-2 overflow-x-auto">
        <b className="text-[clamp(16px,2vw,24px)] px-2 whitespace-nowrap">관리자</b>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`min-h-[48px] text-left rounded-lg px-3 whitespace-nowrap text-[clamp(14px,2vw,16px)] ${tab === t.id ? "bg-white text-gray-900 font-bold" : "hover:bg-gray-700"}`}>
            {t.label}
          </button>
        ))}
        <a href={LAUNCHER} className="min-h-[48px] rounded-lg px-3 inline-flex items-center text-[clamp(14px,2vw,16px)] hover:bg-gray-700 whitespace-nowrap">런처 열기 ↗</a>
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }} className="min-h-[48px] text-left rounded-lg px-3 text-[clamp(14px,2vw,16px)] hover:bg-gray-700">로그아웃</button>
      </aside>

      {/* 모바일 하단 탭 바 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-gray-900 text-white border-t border-gray-700 flex" aria-label="관리자 하단 메뉴">
        {mainTabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setMoreOpen(false); }}
            aria-pressed={tab === t.id}
            className={`flex-1 min-h-[56px] flex items-center justify-center text-[clamp(13px,2vw,15px)] ${tab === t.id ? "font-bold bg-gray-700" : ""}`}>
            {t.label}
          </button>
        ))}
        <button onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen} aria-label="더보기"
          className={`flex-1 min-h-[56px] flex items-center justify-center text-[clamp(13px,2vw,15px)] ${moreOpen || moreTabs.some((t) => t.id === tab) ? "font-bold bg-gray-700" : ""}`}>
          더보기
        </button>
      </nav>

      {/* 더보기 시트 */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-30" role="dialog" aria-label="더보기 메뉴">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-8 flex flex-col gap-1">
            {moreTabs.map((t) => (
              <button key={t.id} onClick={() => { setTab(t.id); setMoreOpen(false); window.scrollTo(0, 0); }}
                className={`min-h-[56px] text-left rounded-lg px-3 text-[clamp(15px,2vw,17px)] ${tab === t.id ? "bg-gray-900 text-white font-bold" : "hover:bg-gray-100"}`}>
                {t.label}
              </button>
            ))}
            <a href={LAUNCHER} className="min-h-[56px] flex items-center rounded-lg px-3 text-[clamp(15px,2vw,17px)] hover:bg-gray-100">런처 열기 ↗</a>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }}
              className="min-h-[56px] text-left rounded-lg px-3 text-[clamp(15px,2vw,17px)] hover:bg-gray-100">로그아웃</button>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 pb-24 md:pb-4 max-w-5xl">
      {toast && (
        <div role="status" aria-live="polite"
          className={`fixed left-4 right-4 md:left-auto md:right-6 bottom-20 md:bottom-6 z-40 rounded-xl border px-4 min-h-[56px] flex items-center text-[clamp(14px,2vw,16px)] shadow-lg ${toast.ok ? "bg-gray-900 text-white border-gray-900" : "bg-white text-red-700 border-red-300"}`}>
          {toast.ok ? "✓ " : "✕ "}{toast.text}
        </div>
      )}

        {tab === "overview" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">개요</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[["전체 앱", apps.length], ["활성", apps.filter((a) => a.isActive !== false).length], ["카테고리", cats.length], ["감사 기록", audit.length]].map(([k, v]) => (
                <div key={k as string} className="bg-white border rounded-2xl p-4">
                  <b className="block text-[clamp(24px,3vw,36px)]">{v}</b>
                  <span className="text-[clamp(12px,1.5vw,14px)] text-gray-500">{k}</span>
                </div>
              ))}
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">런처에 이렇게 보입니다</h2>
            <PreviewGrid apps={apps} />
          </section>
        )}

        {tab === "apps" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">앱 관리</h1>
            <form onSubmit={create} className="grid gap-2 max-w-lg mb-6 bg-white border rounded-2xl p-4">
              {(["name", "slug", "targetUrl", "iconUrl", "description"] as const).map((k) => (
                <input key={k} className={input} placeholder={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              ))}
              <p className="-mt-1 mb-1 text-[clamp(12px,1.5vw,14px)] text-gray-500">슬러그는 영문 소문자·숫자·하이픈만 (한글 입력 시 자동 변환, 비우면 이름에서 생성)</p>
              <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">소속 카테고리 (메뉴에 먼저 생성)
                <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="소속 카테고리">
                  {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">아이콘 업로드 (png/jpg/webp/svg, 1.5MB 이하)
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className={`${input} pt-2`}
                  disabled={uploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadIcon(f);
                    if (url) setForm((s) => ({ ...s, iconUrl: url }));
                    e.target.value = "";
                  }} />
              </label>
              <select className={input} value={form.openMode} onChange={(e) => setForm({ ...form, openMode: e.target.value as "embed" | "direct" })} aria-label="열기 방식">
                <option value="embed">통합 보기 (/apps/슬러그)</option>
                <option value="direct">직접 이동 (targetUrl로 이동)</option>
              </select>
              <button className={primary}>앱 등록</button>
            </form>
            <ul className="grid gap-2">
              {[...apps].sort((a, b) => a.displayOrder - b.displayOrder).map((a) => (
                <li key={a.id} className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[200px] text-[clamp(14px,2vw,16px)]">
                    <b>{a.name}</b> — {a.slug} · {a.category || "전체"} · {a.isActive === false ? "비활성" : "활성"}
                  </span>
                  <button className={btn} onClick={() => move(a.id, -1)} aria-label="위로">↑</button>
                  <button className={btn} onClick={() => move(a.id, 1)} aria-label="아래로">↓</button>
                  <button className={btn} onClick={() => setEditing({ ...a, id: a.id })}>수정</button>
                  <button className={btn} onClick={() => patch(a.id, { isActive: !(a.isActive !== false) })}>
                    {a.isActive === false ? "활성화" : "비활성화"}
                  </button>
                  <button className={btn} onClick={() => remove(a.id)}>삭제</button>
                </li>
              ))}
            </ul>
            {editing && (
              <div className="fixed inset-0 z-30 flex items-center justify-center p-4" role="dialog" aria-label="앱 수정">
                <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
                <form onSubmit={saveEdit} className="relative bg-white rounded-2xl p-4 grid gap-2 w-full max-w-lg">
                  <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold">앱 수정</h2>
                  {(["name", "slug", "targetUrl", "iconUrl", "description"] as const).map((k) => (
                    <input key={k} className={input} placeholder={k} value={editing[k] ?? ""} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
                  ))}
                  <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">소속 카테고리 (메뉴에 먼저 생성)
                    <select className={input} value={editing.category || "전체"} onChange={(e) => setEditing({ ...editing, category: e.target.value })} aria-label="소속 카테고리">
                      {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">아이콘 업로드
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className={`${input} pt-2`}
                      disabled={uploading}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadIcon(f);
                        if (url && editing) setEditing({ ...editing, iconUrl: url });
                        e.target.value = "";
                      }} />
                  </label>
                  <label className="flex items-center gap-2 min-h-[48px] text-[clamp(14px,2vw,16px)]">
                    <input type="checkbox" className="w-6 h-6" checked={!!editing.stripPrefix} onChange={(e) => setEditing({ ...editing, stripPrefix: e.target.checked })} />
                    루트형 앱 (상대가 basePath 없이 동작 → /apps/슬러그 제거 후 전달)
                  </label>
                  <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">관련 링크 (최대 5개)
                    <span className="grid gap-2">
                      {(editing.links || []).map((l, i) => (
                        <span key={i} className="flex gap-1">
                          <input className={`${input} flex-1`} placeholder="이름" value={l.label}
                            onChange={(e) => setEditing({ ...editing, links: (editing.links || []).map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} aria-label="링크 이름" />
                          <input className={`${input} flex-[2]`} placeholder="https://…" value={l.url}
                            onChange={(e) => setEditing({ ...editing, links: (editing.links || []).map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} aria-label="링크 URL" />
                          <button type="button" className={btn} onClick={() => setEditing({ ...editing, links: (editing.links || []).filter((_, j) => j !== i) })} aria-label="링크 삭제">✕</button>
                        </span>
                      ))}
                      {(editing.links || []).length < 5 && (
                        <button type="button" className={btn} onClick={() => setEditing({ ...editing, links: [...(editing.links || []), { label: "", url: "" }] })}>+ 링크 추가</button>
                      )}
                    </span>
                  </label>
                  <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">열기 방식
                    <select className={input} value={editing.openMode || "embed"} onChange={(e) => setEditing({ ...editing, openMode: e.target.value as "embed" | "direct" })} aria-label="열기 방식">
                      <option value="embed">통합 보기 (/apps/슬러그)</option>
                      <option value="direct">직접 이동 (targetUrl로 이동)</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">외부 앱 열기 (복귀 방식)
                    <select className={input} value={editing.openTarget || "self"} onChange={(e) => setEditing({ ...editing, openTarget: e.target.value as "self" | "blank" })} aria-label="외부 앱 열기">
                      <option value="self">같은 탭 (뒤로가기로 런처 복귀)</option>
                      <option value="blank">새 탭 (런처 유지)</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">카드 배경
                    <span className="flex gap-2">
                      <select className={input} value={editing.bgType || "color"} onChange={(e) => setEditing({ ...editing, bgType: e.target.value })} aria-label="카드 배경 방식">
                        <option value="color">단색(RGB)</option>
                        <option value="image">이미지</option>
                        <option value="none">없음(투명, 아이콘만)</option>
                      </select>
                      {(editing.bgType || "color") === "color" ? (
                        <span className="flex gap-2 flex-1">
                          <input type="color" className="min-h-[48px] min-w-[48px]" value={editing.bgColor || "#FFFFFF"} onChange={(e) => setEditing({ ...editing, bgColor: e.target.value })} aria-label="카드 배경 색상" />
                          <input className={`${input} flex-1`} value={editing.bgColor || "#FFFFFF"} onChange={(e) => setEditing({ ...editing, bgColor: e.target.value })} />
                        </span>
                      ) : (
                        <input className={`${input} flex-1`} placeholder="/uploads/카드.png 또는 https://…" value={editing.bgImage || ""} onChange={(e) => setEditing({ ...editing, bgImage: e.target.value })} />
                      )}
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" className={`${primary} flex-1`}>저장</button>
                    <button type="button" className={`${btn}`} onClick={() => setEditing(null)}>취소</button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {tab === "categories" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">카테고리·메뉴 관리</h1>
            <p className="text-[clamp(14px,2vw,16px)] text-gray-600 mb-3">런처 상단 메뉴 탭 순서·이름을 여기서 관리합니다.</p>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">새 카테고리 만들기</h2>
            <form onSubmit={createCat} className="flex gap-2 max-w-lg mb-6">
              <input className={`${input} flex-1`} placeholder="새 카테고리 이름" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="새 카테고리 이름" />
              <button className={primary}>생성</button>
            </form>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">메뉴 순서·삭제</h2>
            <ul className="grid gap-2 mb-6">
              {menuCats.map((c) => (
                <li key={c} className="bg-white border rounded-lg p-3 text-[clamp(14px,2vw,16px)]">
                  <div className="flex items-center gap-2">
                    <span className="flex-1"><b>{c}</b> — {apps.filter((a) => (a.category || "전체") === c).length}개 앱</span>
                    <button className={btn} onClick={() => menuMove(c, -1)} aria-label={`${c} 위로`}>↑</button>
                    <button className={btn} onClick={() => menuMove(c, 1)} aria-label={`${c} 아래로`}>↓</button>
                    <button className={btn} onClick={() => deleteCat(c)}>삭제</button>
                  </div>
                  <ul className="mt-2 grid gap-1">
                    {apps.filter((a) => (a.category || "전체") === c).map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-[clamp(12px,1.5vw,14px)]">
                        <span className="flex-1">{a.name} ({a.slug})</span>
                        <select className="min-h-[48px] border rounded-lg px-2" value={a.category || "전체"}
                          onChange={(e) => patch(a.id, { category: e.target.value })}
                          aria-label={`${a.name} 소속 카테고리`}>
                          {catOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">이름 변경</h2>
            <form onSubmit={renameCat} className="grid gap-2 max-w-lg mb-6 bg-white border rounded-2xl p-4">
              <input className={input} placeholder="기존 이름 (from)" value={rename.from} onChange={(e) => setRename({ ...rename, from: e.target.value })} />
              <input className={input} placeholder="새 이름 (to)" value={rename.to} onChange={(e) => setRename({ ...rename, to: e.target.value })} />
              <button className={primary}>이름 변경</button>
            </form>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">삭제 시 앱 이동처</h2>
            <div className="max-w-lg bg-white border rounded-2xl p-4">
              <input className={`${input} w-full`} placeholder="이동처 카테고리 (기본: 전체)" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="이동처 카테고리" />
            </div>
          </section>
        )}

        {tab === "devices" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">장비 관리</h1>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[["전체", devices.length],
                ["승인 대기", devices.filter((d) => d.status === "pending").length],
                ["온라인", devices.filter((d) => Date.now() - new Date(d.lastSeen).getTime() < 5 * 60 * 1000).length]
              ].map(([k, v]) => (
                <div key={k as string} className="bg-white border rounded-2xl p-4">
                  <b className="block text-[clamp(24px,3vw,36px)]">{v}</b>
                  <span className="text-[clamp(12px,1.5vw,14px)] text-gray-500">{k} (5분 heartbeat)</span>
                </div>
              ))}
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target as HTMLFormElement);
              const { ok, j } = await api("/api/admin/devices", {
                method: "POST", headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: String(fd.get("name") || "미지정 장비"), placement: String(fd.get("placement") || "") })
              });
              result(ok, `장비 사전등록됨 (코드 ${j.data?.code ?? ""})`, j);
              if (ok) { (e.target as HTMLFormElement).reset(); load(); }
            }} className="flex flex-wrap gap-2 max-w-2xl bg-white border rounded-2xl p-4 mb-4">
              <input name="name" className={`${input} flex-1 min-w-[140px]`} placeholder="장비 이름" aria-label="새 장비 이름" />
              <input name="placement" className={`${input} flex-1 min-w-[140px]`} placeholder="배치 (시·구·센터)" aria-label="새 장비 배치" />
              <button className={primary}>사전 등록</button>
            </form>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] bg-white border rounded-2xl text-[clamp(12px,1.5vw,14px)]">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="p-2">장비 UUID</th><th className="p-2">화면</th><th className="p-2">상태</th>
                  <th className="p-2">등록 코드</th><th className="p-2">배치</th><th className="p-2">배정 화면</th>
                  <th className="p-2">heartbeat</th><th className="p-2">저장소</th><th className="p-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-b align-top">
                    <td className="p-2"><b>{d.name}</b><span className="block font-mono text-[11px] text-gray-500 break-all">{d.uuid.slice(0, 13)}…</span></td>
                    <td className="p-2 whitespace-nowrap">{d.screen || "-"}</td>
                    <td className="p-2 whitespace-nowrap">{d.status === "approved" ? "승인됨" : d.status === "rejected" ? "거부됨" : "대기"}</td>
                    <td className="p-2 font-mono font-bold tracking-widest">{d.code}</td>
                    <td className="p-2">
                      <input className="min-h-[48px] border rounded-lg px-2 w-28" defaultValue={d.placement || ""} id={`pl-${d.id}`} aria-label={`${d.name} 배치`} />
                      <button className={btn} onClick={() => {
                        const v = (document.getElementById(`pl-${d.id}`) as HTMLInputElement).value;
                        setDevice(d.uuid, { placement: v }, "배치 저장됨");
                      }}>저장</button>
                    </td>
                    <td className="p-2">
                      <select className="min-h-[48px] border rounded-lg px-2 max-w-[140px]" value={(d as Device & { assignedSlug?: string }).assignedSlug || ""}
                        onChange={(e) => setDevice(d.uuid, { assignedSlug: e.target.value }, "표시 화면 지정됨")}
                        aria-label={`${d.name} 표시 화면`}>
                        <option value="">미지정</option>
                        <option value="all">전체 앱</option>
                        <optgroup label="카테고리">
                          {cats.map((c) => <option key={c} value={`cat:${c}`}>{c} 전체</option>)}
                        </optgroup>
                        <optgroup label="개별 앱">
                          {apps.filter((a) => a.isActive !== false).map((a) => <option key={a.id} value={a.slug}>{a.name}</option>)}
                        </optgroup>
                        <optgroup label="템플릿">
                          {tpls.filter((t) => t.status === "published").map((t) => <option key={t.id} value={`t:${t.slug}`}>{t.name} v{t.version}</option>)}
                        </optgroup>
                      </select>
                      {(() => {
                        const slug = (d as Device & { assignedSlug?: string }).assignedSlug || "";
                        if (slug.startsWith("t:")) {
                          const t = tpls.find((x) => x.slug === slug.slice(2));
                          return t ? <span className="block text-[11px] text-gray-500">{t.name} v{t.version}</span> : null;
                        }
                        return null;
                      })()}
                    </td>
                    <td className="p-2 whitespace-nowrap text-gray-500">{d.lastSeen ? new Date(d.lastSeen).toLocaleString("ko-KR") : "-"}</td>
                    <td className="p-2">{d.storagePct !== undefined && d.storagePct >= 0 ? `${d.storagePct}%` : "-"}</td>
                    <td className="p-2 whitespace-nowrap">
                      <button className={btn} onClick={() => setDevice(d.uuid, { status: "approved" }, "장비 승인됨")}>승인</button>
                      <button className={btn} onClick={() => setDevice(d.uuid, { status: "rejected" }, "장비 거부됨")}>거부</button>
                      <button className={btn} onClick={() => removeDevice(d.uuid)}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {devices.length === 0 && <p className="text-gray-500 mt-2">등록된 장비 없음 — 런처 /device·/kiosk 화면을 열면 여기 표시됩니다</p>}
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mt-4 mb-2">시간대 스케줄 (장비별 화면 자동 전환)</h2>
            <div className="max-w-2xl bg-white border rounded-2xl p-4 grid gap-2">
              <select className={input} value={sched?.uuid || ""} onChange={(e) => {
                const d = devices.find((x) => x.uuid === e.target.value);
                let rows: { from: string; to: string; target: string }[] = [];
                try { rows = JSON.parse((d as unknown as { schedule?: string })?.schedule || "[]"); } catch { rows = []; }
                setSched({ uuid: e.target.value, rows: Array.isArray(rows) ? rows : [] });
              }} aria-label="스케줄 장비 선택">
                <option value="">장비 선택</option>
                {devices.map((d) => <option key={d.id} value={d.uuid}>{d.name} ({d.code})</option>)}
              </select>
              {sched && (<>
                {(sched.rows || []).map((r, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <input type="time" className={input} value={r.from} onChange={(e) => setSched({ ...sched, rows: sched.rows.map((x, j) => j === i ? { ...x, from: e.target.value } : x) })} aria-label="시작" />
                    <span>~</span>
                    <input type="time" className={input} value={r.to} onChange={(e) => setSched({ ...sched, rows: sched.rows.map((x, j) => j === i ? { ...x, to: e.target.value } : x) })} aria-label="종료" />
                    <select className={`${input} flex-1`} value={r.target} onChange={(e) => setSched({ ...sched, rows: sched.rows.map((x, j) => j === i ? { ...x, target: e.target.value } : x) })} aria-label="시간대 화면">
                      <option value="all">전체 앱</option>
                      {cats.map((c) => <option key={c} value={`cat:${c}`}>{c} 전체</option>)}
                      {apps.filter((a) => a.isActive !== false).map((a) => <option key={a.id} value={a.slug}>{a.name}</option>)}
                      {tpls.filter((t) => t.status === "published").map((t) => <option key={t.id} value={`t:${t.slug}`}>{t.name} v{t.version}</option>)}
                    </select>
                    <button className={btn} onClick={() => setSched({ ...sched, rows: sched.rows.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button className={btn} onClick={() => setSched({ ...sched, rows: [...(sched.rows || []), { from: "09:00", to: "18:00", target: "all" }] })}>+ 시간대</button>
                  <button className={primary} onClick={() => setDevice(sched.uuid, { schedule: JSON.stringify(sched.rows) } as unknown as { status?: string }, "스케줄 저장됨")}>스케줄 저장</button>
                </div>
              </>)}
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mt-4 mb-2">원격 명령 (재시작·캐시비우기·새로고침)</h2>
            <div className="max-w-2xl bg-white border rounded-2xl p-4 flex flex-wrap gap-2">
              <select className={input} id="cmd-dev" aria-label="명령 대상 장비">
                {devices.filter((d) => d.status === "approved").map((d) => <option key={d.id} value={d.uuid}>{d.name} ({d.code})</option>)}
              </select>
              {(["refresh", "clearCache", "reboot"] as const).map((c) => (
                <button key={c} className={btn} onClick={() => {
                  const el = document.getElementById("cmd-dev") as HTMLSelectElement | null;
                  if (!el?.value) { notify("장비를 선택하세요", false); return; }
                  setDevice(el.value, { pendingCommand: c } as unknown as { status?: string }, `명령 전송됨: ${c}`);
                }}>{c === "refresh" ? "새로고침" : c === "clearCache" ? "캐시비우기" : "재시작"}</button>
              ))}
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mt-4 mb-2">하드웨어 드라이버 (시뮬레이션)</h2>
            <div className="max-w-2xl bg-white border rounded-2xl p-4 grid gap-2">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target as HTMLFormElement);
                const { ok, j } = await api("/api/admin/drivers", {
                  method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ name: String(fd.get("name") || ""), type: String(fd.get("type") || "etc"), mode: String(fd.get("mode") || "simulation") })
                });
                result(ok, "드라이버 등록됨", j);
                if (ok) { (e.target as HTMLFormElement).reset(); load(); }
              }} className="flex flex-wrap gap-2">
                <input name="name" className={`${input} flex-1 min-w-[120px]`} placeholder="이름 (예: 영수증 프린터)" aria-label="드라이버 이름" />
                <select name="type" className={input} aria-label="종류">
                  <option value="printer">printer</option><option value="payment">payment</option>
                  <option value="scanner">scanner</option><option value="etc">etc</option>
                </select>
                <select name="mode" className={input} aria-label="모드">
                  <option value="simulation">simulation</option><option value="real">real</option>
                </select>
                <button className={primary}>등록</button>
              </form>
              <ul className="grid gap-1">
                {drvs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-[clamp(13px,2vw,15px)] border-b py-2">
                    <span className="flex-1"><b>{d.name}</b> · {d.type} · {d.mode}</span>
                    <button className={btn} onClick={async () => {
                      const r = await fetch("/api/device/driver", {
                        method: "POST", headers: { "content-type": "application/json" },
                        body: JSON.stringify({ uuid: "admin-test", driverId: d.id, command: "test" })
                      });
                      const j = await r.json().catch(() => ({}));
                      notify(r.ok && j.success ? `실행됨: ${j.data?.result}` : (j.error?.message ?? "실패"), r.ok && j.success);
                    }}>테스트 실행</button>
                    <button className={btn} onClick={async () => {
                      await fetch(`/api/admin/drivers?id=${d.id}`, { method: "DELETE" });
                      load();
                    }}>삭제</button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "users" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">사용자 관리</h1>
            <form onSubmit={createUser} className="grid gap-2 max-w-lg bg-white border rounded-2xl p-4 mb-4">
              <input className={input} placeholder="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              <input className={input} placeholder="password (8자 이상)" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              <select className={input} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} aria-label="역할">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button className={primary}>사용자 생성</button>
            </form>
            <ul className="grid gap-2">
              {users.map((u) => (
                <li key={u.id} className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-2 text-[clamp(14px,2vw,16px)]">
                  <span className="flex-1 min-w-[180px]">{u.email} · {u.role}</span>
                  <select className={input} value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value })} aria-label={`${u.email} 역할`}>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button className={btn} onClick={() => {
                    const pw = prompt(`${u.email} 새 비밀번호 (8자 이상)`);
                    if (pw) updateUser(u.id, { password: pw });
                  }}>비번 초기화</button>
                  <button className={btn} onClick={() => removeUser(u.id, u.email)}>삭제</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "templates" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">템플릿 (키오스크 화면 에디터)</h1>
            <div className="bg-white border rounded-2xl p-4 mb-4">
              <b className="text-[clamp(15px,2vw,17px)]">샘플 마켓 (원클릭 생성)</b>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { name: "카페 주문 샘플", slug: `sample-cafe-${Date.now().toString(36)}`, category: "전체", industry: "CAFE", pages: [
                    { id: "p1", title: "홈", components: [
                      { id: "c1", type: "appbar", props: { title: "무인카페", bg: "#7C2D12", color: "#FFFFFF", size: 20 } },
                      { id: "c2", type: "ticker", props: { text: "신메뉴 출시! 전 음료 10% 할인", bg: "#111111", color: "#FFFFFF", size: 15 } },
                      { id: "c3", type: "text", props: { content: "메뉴를 골라 담아보세요", size: 18, color: "#111111" } },
                      { id: "c4", type: "button", props: { label: "주문 시작", bg: "#C2410C", color: "#FFFFFF", size: 22, height: 64, target: "p2", actions: [] } }
                    ]},
                    { id: "p2", title: "완료", components: [
                      { id: "c5", type: "text", props: { content: "주문이 접수되었습니다", size: 22, color: "#111111" } },
                      { id: "c6", type: "survey", props: { question: "주문이 편했나요?" } },
                      { id: "c7", type: "nav", props: { label: "처음으로", target: "/" } }
                    ] }
                  ] },
                  { name: "도서관 안내 샘플", slug: `sample-lib-${Date.now().toString(36)}`, category: "전체", industry: "LIBRARY", pages: [
                    { id: "p1", title: "홈", components: [
                      { id: "c1", type: "appbar", props: { title: "스마트도서관", bg: "#1D4ED8", color: "#FFFFFF", size: 20 } },
                      { id: "c2", type: "text", props: { content: "대출·반납 안내", size: 20, color: "#111111" } },
                      { id: "c3", type: "button", props: { label: "대출하기", bg: "#1D4ED8", color: "#FFFFFF", size: 22, height: 64, target: "", actions: [{ type: "TOAST", text: "바코드를 스캔하세요" }] } },
                      { id: "c4", type: "quiz", props: { question: "대출 기간은?", options: ["7일", "14일"], answer: 1 } }
                    ]}
                  ] },
                  { name: "헬스케어 측정 샘플", slug: `sample-health-${Date.now().toString(36)}`, category: "전체", industry: "HEALTH", pages: [
                    { id: "p1", title: "홈", components: [
                      { id: "c1", type: "appbar", props: { title: "건강 측정", bg: "#0d9488", color: "#FFFFFF", size: 20 } },
                      { id: "c2", type: "progress", props: { label: "오늘 목표", value: 60, max: 100, bg: "#0d9488" } },
                      { id: "c3", type: "numpad", props: { label: "회원 번호", target: "" } },
                      { id: "c4", type: "survey", props: { question: "측정이 편했나요?" } }
                    ]}
                  ] }
                ].map((s) => (
                  <button key={s.name} className={btn} onClick={async () => {
                    const { ok, j } = await api("/api/admin/templates", {
                      method: "POST", headers: { "content-type": "application/json" },
                      body: JSON.stringify({ name: s.name, slug: s.slug, category: s.category })
                    });
                    if (!ok) { result(false, j.error?.message ?? "실패", j); return; }
                    const nid = (j.data as { id: string }).id;
                    const r2 = await api("/api/admin/templates", {
                      method: "PATCH", headers: { "content-type": "application/json" },
                      body: JSON.stringify({ id: nid, industry: s.industry, pages: s.pages })
                    });
                    result(r2.ok, "샘플 생성됨 — 열어서 게시하세요", r2.j);
                    if (r2.ok) load();
                  }}>{s.name} 만들기</button>
                ))}
              </div>
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">데이터셋 (엑셀 일괄등록)</h2>
            <div className="bg-white border rounded-2xl p-4 mb-4 grid gap-2">
              <p className="text-[clamp(12px,1.5vw,14px)] text-gray-500">.xlsx/.csv 첫 행 헤더 (이름·가격·이미지·카테고리·재고), 500행까지. 상품그리드에서 바인딩. 샘플 양식을 받아 채운 뒤 업로드하세요.</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { n: "카페 메뉴 양식", h: "이름,가격,카테고리,이미지", r: "아메리카노,3000,커피,\n카페라떼,4000,커피," },
                  { n: "음식 주문 양식", h: "이름,가격,카테고리,이미지", r: "김치찌개,8000,한식,\n된장찌개,8000,한식," },
                  { n: "좌석표 양식 (예약용)", h: "좌석번호,등급,가격,상태", r: "A1,일반,10000,가능\nA2,일반,10000,가능\nB1,우등,15000,가능" },
                  { n: "의사 일정 양식 (예약용)", h: "의사,진료과,시간,상태", r: "김의사,내과,09:00,가능\n이의사,외과,10:00,가능" }
                ].map((s) => (
                  <button key={s.n} className={btn} onClick={() => {
                    const blob = new Blob([`﻿${s.h}\n${s.r}`], { type: "text/csv;charset=utf-8" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${s.n}.csv`;
                    a.click();
                    notify("샘플 양식 다운로드됨");
                  }}>📝 {s.n}</button>
                ))}
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target as HTMLFormElement);
                const f = fd.get("file") as File | null;
                if (!f) return;
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const r = new FileReader();
                  r.onload = () => resolve(r.result as string);
                  r.onerror = reject;
                  r.readAsDataURL(f);
                });
                const r = await fetch("/api/admin/datasets/upload", {
                  method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ name: String(fd.get("name") || f.name), filename: f.name, dataUrl })
                });
                const j = await r.json().catch(() => ({}));
                result(r.ok && j.success, `데이터셋 등록됨 (${j.data?.total ?? 0}행)`, j);
                if (r.ok) { (e.target as HTMLFormElement).reset(); load(); }
              }} className="flex flex-wrap gap-2">
                <input name="name" className={`${input} flex-1 min-w-[120px]`} placeholder="데이터셋 이름" aria-label="데이터셋 이름" />
                <input name="file" type="file" accept=".xlsx,.csv" className={`${input} pt-2 flex-1 min-w-[160px]`} aria-label="엑셀/CSV 파일" />
                <button className={primary}>업로드</button>
              </form>
              <ul className="grid gap-1">
                {dss.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-[clamp(13px,2vw,15px)] border-b py-2">
                    <span className="flex-1"><b>{d.name}</b> — {d.total}행 · {d.columns.join(", ")}</span>
                    <button className={btn} onClick={async () => {
                      if (!confirm("데이터셋을 삭제할까요?")) return;
                      const r = await fetch(`/api/admin/datasets?id=${d.id}`, { method: "DELETE" });
                      const j = await r.json().catch(() => ({}));
                      result(r.ok && j.success, "데이터셋 삭제됨", j);
                      if (r.ok) load();
                    }}>삭제</button>
                  </li>
                ))}
              </ul>
            </div>
            <form onSubmit={createTpl} className="flex flex-wrap gap-2 max-w-2xl bg-white border rounded-2xl p-4 mb-4">
              <input className={`${input} flex-1 min-w-[120px]`} placeholder="이름" value={newTpl.name} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} aria-label="새 템플릿 이름" />
              <input className={`${input} flex-1 min-w-[120px]`} placeholder="슬러그 (비우면 자동)" value={newTpl.slug} onChange={(e) => setNewTpl({ ...newTpl, slug: e.target.value })} aria-label="새 템플릿 슬러그" />
              <select className={input} value={newTpl.category} onChange={(e) => setNewTpl({ ...newTpl, category: e.target.value })} aria-label="새 템플릿 카테고리">
                {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className={primary}>새 템플릿</button>
            </form>
            <ul className="grid gap-2 mb-6">
              {tpls.map((t) => (
                <li key={t.id} className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-2 text-[clamp(14px,2vw,16px)]">
                  <span className="flex-1 min-w-[200px]"><b>{t.name}</b> — {t.slug} · {t.status === "published" ? `게시됨 v${t.version}` : t.status === "review" ? "검수중" : "초안"} · {t.pageCount}페이지</span>
                  <button className={btn} onClick={() => openTpl(t.id)}>열기</button>
                  <button className={btn} onClick={async () => {
                    const { ok, j } = await api("/api/admin/templates", {
                      method: "POST", headers: { "content-type": "application/json" },
                      body: JSON.stringify({ name: `${t.name} (사본)`, category: t.category || "전체" })
                    });
                    if (!ok) { result(false, j.error?.message ?? "실패", j); return; }
                    const nid = (j.data as { id: string }).id;
                    // 원본 pages 읽기 (열려 있으면 로컬, 아니면 서버에서)
                    let srcPages: { id: string; components: { id: string }[] }[] = (tpl && tpl.id === t.id) ? tpl.pages : [];
                    if (!srcPages.length) {
                      const full = await fetch("/api/admin/templates", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: t.id }) }).then((r) => r.json()).catch(() => null);
                      if (full?.success && Array.isArray(full.data?.pages)) srcPages = full.data.pages;
                    }
                    srcPages = JSON.parse(JSON.stringify(srcPages));
                    srcPages.forEach((pg, pi) => {
                      pg.id = `p${Date.now()}${pi}`;
                      (pg.components || []).forEach((c, ci) => { c.id = `c${Date.now()}${pi}${ci}`; });
                    });
                    await api("/api/admin/templates", {
                      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: nid, pages: srcPages })
                    });
                    notify("템플릿 복제됨");
                    load();
                  }}>📋 복제</button>
                  <button className={btn} onClick={() => publishTpl(t.id)}>게시</button>
                  <button className={btn} onClick={() => removeTpl(t.id)}>삭제</button>
                </li>
              ))}
              {tpls.length === 0 && <li className="text-gray-500">템플릿 없음</li>}
            </ul>
            {tpl && (
              <div className="bg-white border rounded-2xl p-4 grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[clamp(18px,2.5vw,24px)]">{tpl.name}</b>
                  <span className="text-[clamp(12px,1.5vw,14px)] text-gray-500">{tpl.status} v{tpl.version}</span>
                  <a className="min-h-[48px] inline-flex items-center rounded-lg border px-3" href={`/t/${tpl.slug}`} target="_blank" rel="noreferrer">미리보기 ↗</a>
                  <button className={primary} onClick={() => saveTpl(tpl)}>저장</button>
                  {(tpl.status === "draft" || !tpl.status) && (<>
                    <button className={btn} onClick={async () => {
                      const r = await fetch("/api/admin/templates/stage", {
                        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: tpl.id })
                      });
                      const j = await r.json().catch(() => ({}));
                      result(r.ok && j.success, "스테이징됨 — 실제 화면 링크로 검수 후 게시하세요", j);
                      if (r.ok) load();
                    }}>스테이징 (검수용 공개)</button>
                    <button className={btn} onClick={() => publishTpl(tpl.id)}>게시 (접근성 검증)</button>
                  </>)}
                  {tpl.status === "review" && (<>
                    <button className={btn} onClick={() => publishTpl(tpl.id)}>게시 (접근성 검증)</button>
                    <button className={btn} onClick={async () => {
                      const r = await fetch("/api/admin/templates/unpublish", {
                        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: tpl.id })
                      });
                      const j = await r.json().catch(() => ({}));
                      result(r.ok && j.success, "초안으로 되돌림", j);
                      if (r.ok) load();
                    }}>초안으로</button>
                  </>)}
                  {tpl.status === "published" && (<>
                    <button className={btn} onClick={async () => {
                      const r = await fetch("/api/admin/templates/stage", {
                        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: tpl.id })
                      });
                      const j = await r.json().catch(() => ({}));
                      result(r.ok && j.success, "검수중으로 내림 (런처에서 숨김)", j);
                      if (r.ok) load();
                    }}>검수로 내리기</button>
                    <button className={btn} onClick={async () => {
                      const r = await fetch("/api/admin/templates/unpublish", {
                        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: tpl.id })
                      });
                      const j = await r.json().catch(() => ({}));
                      result(r.ok && j.success, "게시 취소됨 (초안으로)", j);
                      if (r.ok) load();
                    }}>게시 취소</button>
                  </>)}
                  {autoSaved && <span className="text-[clamp(12px,1.5vw,14px)] text-gray-500">자동 저장됨 {autoSaved}</span>}
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="grid gap-1 text-[clamp(13px,2vw,15px)]">이름
                    <input className={input} value={tpl.name} onChange={(e) => updTpl({ name: e.target.value })} /></label>
                  <label className="grid gap-1 text-[clamp(13px,2vw,15px)]">카테고리
                    <select className={input} value={tpl.category || "전체"} onChange={(e) => updTpl({ category: e.target.value })} aria-label="템플릿 카테고리">
                      {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select></label>
                  <label className="grid gap-1 text-[clamp(13px,2vw,15px)]">완료 화면 (APP_COMPLETE)
                    <select className={input} value={tpl.completePageId || ""} onChange={(e) => updTpl({ completePageId: e.target.value || null })} aria-label="완료 화면">
                      <option value="">없음</option>
                      {tpl.pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select></label>
                  <label className="grid gap-1 text-[clamp(13px,2vw,15px)]">산업군
                    <select className={input} value={tpl.industry || ""} onChange={(e) => updTpl({ industry: e.target.value })} aria-label="산업군">
                      {["", "EDUCATION", "CAFE", "LIBRARY", "HEALTH", "TRANSPORT", "PUBLIC"].map((v) => <option key={v} value={v}>{v || "미지정"}</option>)}
                    </select></label>
                  <label className="grid gap-1 text-[clamp(13px,2vw,15px)]">태그 (쉼표 구분)
                    <input className={input} value={tpl.tags || ""} onChange={(e) => updTpl({ tags: e.target.value })} /></label>
                  <label className="grid gap-1 text-[clamp(13px,2vw,15px)]">실행 모드
                    <select className={input} value={tpl.runMode || "live"} onChange={(e) => updTpl({ runMode: e.target.value })} aria-label="실행 모드">
                      <option value="live">실서비스</option>
                      <option value="demo">데모</option>
                    </select></label>
                </div>
                {(tpl.versions || []).length > 0 && (
                  <div className="text-[clamp(13px,2vw,15px)]">버전: {(tpl.versions || []).map((v: number | { version: number }) => {
                    const n = typeof v === "number" ? v : v.version;
                    return <button key={n} className="border rounded-lg px-2 py-1 mr-1 min-h-[48px]" onClick={() => rollbackTpl(tpl.id, n)}>v{n}로 롤백</button>;
                  })}</div>
                )}
                <div className="flex gap-2 items-center flex-wrap">
                  <b>미리보기</b>
                  <select className={input} value={previewW} onChange={(e) => setPreviewW(Number(e.target.value))} aria-label="미리보기 너비">
                    <option value={390}>모바일 390</option>
                    <option value={768}>태블릿 768</option>
                    <option value={1080}>키오스크 1080</option>
                  </select>
                  <a className="min-h-[48px] inline-flex items-center rounded-lg border px-3" href={`/t/${tpl.slug}`} target="_blank" rel="noreferrer">실제 화면 ↗</a>
                  <button className={btn} onClick={() => {
                    const blob = new Blob([JSON.stringify({ slug: tpl.slug, name: tpl.name, category: tpl.category, pages: tpl.pages, completePageId: tpl.completePageId }, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${tpl.slug}.template.json`;
                    a.click();
                    notify("템플릿 내보냄");
                  }}>내보내기</button>
                  <label className={`${btn} cursor-pointer`}>가져오기
                    <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const j = JSON.parse(await f.text());
                        if (!Array.isArray(j.pages)) { notify("템플릿 JSON이 아닙니다", false); return; }
                        updTpl({ pages: j.pages, completePageId: j.completePageId ?? null });
                        notify("불러옴 — 저장 버튼을 누르세요");
                      } catch { notify("파싱 실패", false); }
                      e.target.value = "";
                    }} />
                  </label>
                </div>
                <div className="overflow-x-auto bg-gray-100 rounded-xl p-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragType) { addComp(dragType); setDragType(null); } }}
                  onClick={(e) => {
                    const box = e.currentTarget.querySelector(".pv-nodes");
                    if (!box) return;
                    const el = (e.target as HTMLElement).closest(".pv-nodes > *");
                    const idx = Array.from(box.children).indexOf(el as Element);
                    const comps = (tpl.pages[tplPage] || tpl.pages[0] || { components: [] }).components || [];
                    if (idx >= 0 && comps[idx]) {
                      setSelComp(comps[idx].id);
                      document.getElementById(`ec-${comps[idx].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}>
                  <p className="text-[clamp(12px,1.5vw,14px)] text-gray-500 mb-2">팔레트에서 드래그해서 놓으면 현재 페이지에 추가 · 클릭하면 편집기로 이동</p>
                  <div className="pv-items mx-auto bg-white rounded-xl border grid gap-2 p-3" style={{ width: previewW, maxWidth: "none" }}>
                    <div className="px-3 min-h-[44px] flex items-center gap-2 border-b font-bold">{tpl.name}</div>
                    <div className="flex gap-1 items-center px-1">
                      <button className="min-h-[44px] px-2 border rounded-lg" onClick={() => setPvIdx((i) => Math.max(0, i - 1))} aria-label="이전 미리보기">◀</button>
                      <span className="flex-1 text-center text-[clamp(12px,1.5vw,14px)] text-gray-500">
                        {(tpl.pages[pvIdx] || tpl.pages[0] || { title: "없음" }).title} ({Math.min(pvIdx + 1, tpl.pages.length)}/{tpl.pages.length || 0}) — 버튼 클릭 시 실제 이동
                      </span>
                      <button className="min-h-[44px] px-2 border rounded-lg" onClick={() => setPvIdx((i) => Math.min(tpl.pages.length - 1, i + 1))} aria-label="다음 미리보기">▶</button>
                    </div>
                    <div className="pv-nodes p-3 grid gap-2">
                      {((tpl.pages[pvIdx] || tpl.pages[0] || { components: [] }).components || []).map((c) => {
                        const p = (c.props || {}) as Record<string, string | number | string[]>;
                        const goPv = (target: string) => {
                          if (!target) return;
                          const i = tpl.pages.findIndex((x) => x.id === target);
                          if (i >= 0) setPvIdx(i);
                        };
                        if (c.type === "text") return <div key={c.id} style={{ fontSize: Number(p.size) || 18 }}>{String(p.content || "텍스트")}</div>;
                        if (c.type === "button") return <button key={c.id} onClick={() => goPv(String(p.target || ""))} style={{ background: String(p.bg || "#C2410C"), color: String(p.color || "#fff"), borderRadius: 12, minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", border: 0, width: "100%" }}>{String(p.label || "버튼")}</button>;
                        if (c.type === "image") return <div key={c.id} style={{ background: "#eee", borderRadius: 12, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>🖼 이미지</div>;
                        if (c.type === "video") return <div key={c.id} style={{ background: "#000", color: "#fff", borderRadius: 12, minHeight: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>▶ 동영상</div>;
                        if (c.type === "html") return <PvHtml key={c.id} html={String(p.html || "")} />;
                        if (c.type === "html") return <div key={c.id} style={{ border: "1px dashed #aaa", borderRadius: 10, padding: 10, color: "#666" }}>&lt;HTML&gt; 미리보기는 실제 화면에서 확인</div>;
                        if (c.type === "appbar") return <div key={c.id} style={{ background: String(p.bg || "#0d9488"), color: "#fff", borderRadius: 10, padding: 12, fontWeight: "bold" }}>{String(p.title || "제목")}</div>;
                        if (c.type === "quiz") return <div key={c.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>❓ {String(p.question || "질문")}</div>;
                        if (c.type === "survey") return <div key={c.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, textAlign: "center" }}>😊 😐 😞</div>;
                        if (c.type === "ticker") return <div key={c.id} style={{ background: "#111", color: "#fff", borderRadius: 8, padding: 8, overflow: "hidden", whiteSpace: "nowrap" }}>{String(p.text || "공지")}</div>;
                        if (c.type === "numpad") return <div key={c.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, textAlign: "center" }}>1 2 3<br />4 5 6<br />7 8 9</div>;
                        if (c.type === "productgrid") return <div key={c.id} style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>{[1, 2, 3, 4].map((i) => <div key={i} style={{ background: "#f5f5f5", borderRadius: 8, minHeight: 70 }} />)}</div>;
                        if (c.type === "progress") return <div key={c.id} style={{ height: 12, background: "#eee", borderRadius: 6 }}><div style={{ width: `${Number(p.value) || 30}%`, height: "100%", background: "#0d9488", borderRadius: 6 }} /></div>;
                        return <div key={c.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>{String(p.label || c.type)}</div>;
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <b>페이지 ({tpl.pages.length})</b>
                  <button className={btn} onClick={() => {
                    const n = tpl.pages.length + 1;
                    updTpl({ pages: [...tpl.pages, { id: `p${Date.now()}`, title: `화면${n}`, components: [] }] });
                  }}>+ 페이지</button>
                  {tpl.pages.length === 0 && <span className="text-[clamp(13px,2vw,15px)] text-red-600">← 먼저 페이지를 추가하세요 (페이지 없으면 게시 불가)</span>}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {tpl.pages.map((p, i) => (
                    <button key={p.id} onClick={() => setTplPage(i)}
                      className={`min-h-[48px] whitespace-nowrap rounded-lg border px-3 ${i === tplPage ? "bg-gray-900 text-white font-bold" : ""}`}>
                      {p.title} ({(p.components || []).length}개){tpl.completePageId === p.id ? " ★완료" : ""}</button>
                  ))}
                </div>
                {tpl.pages[tplPage] && (
                  <div className="border rounded-xl p-3 grid gap-2">
                    <div className="flex gap-2 items-center">
                      <input className={`${input} flex-1`} value={tpl.pages[tplPage].title}
                        onChange={(e) => updPage(tpl.pages[tplPage].id, { title: e.target.value })} aria-label="페이지 제목" />
                      <input type="color" className="min-h-[48px] min-w-[48px]" value={tpl.pages[tplPage].bg || "#FFF7ED"}
                        onChange={(e) => updPage(tpl.pages[tplPage].id, { bg: e.target.value })} aria-label="화면 배경색" title="화면 배경색" />
                      <label className={`${btn} cursor-pointer`}>배경이미지
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const url = await uploadIcon(f);
                            if (url) updPage(tpl.pages[tplPage].id, { bgImage: url });
                            e.target.value = "";
                          }} />
                      </label>
                      {(tpl.pages[tplPage].bgImage) && (
                        <button className={btn} onClick={() => updPage(tpl.pages[tplPage].id, { bgImage: "" })}>배경삭제</button>
                      )}
                      <button className={btn} onClick={() => {
                        const ps = tpl.pages.filter((_, j) => j !== tplPage);
                        updTpl({ pages: ps }); setTplPage(0);
                      }}>페이지 삭제</button>
                      <button className={btn} onClick={() => {
                        const src = tpl.pages[tplPage];
                        if (!src) return;
                        const copy = JSON.parse(JSON.stringify(src));
                        copy.id = `p${Date.now()}`;
                        copy.title = `${src.title} (사본)`;
                        (copy.components || []).forEach((c: { id: string }, i: number) => { c.id = `c${Date.now()}${i}`; });
                        const ps = [...tpl.pages];
                        ps.splice(tplPage + 1, 0, copy);
                        updTpl({ pages: ps });
                        notify("페이지 복제됨");
                      }}>📋 페이지 복제</button>
                    </div>
                    {(["text", "button", "image", "video", "nav", "appbar", "progress", "ticker", "quiz", "survey", "numpad", "productgrid", "html", "calendar", "weather", "chart", "tabs", "videolist"] as const).map((t) => (
                      <button key={t} draggable
                        onDragStart={(e) => { setDragType(t); e.dataTransfer.effectAllowed = "copy"; }}
                        onDragEnd={() => setDragType(null)}
                        onClick={() => addComp(t)} className={btn}>
                        + {t === "text" ? "텍스트" : t === "button" ? "버튼" : t === "image" ? "이미지" : t === "video" ? "동영상" : t === "nav" ? "내비" : t === "appbar" ? "앱바" : t === "progress" ? "진행률" : t === "ticker" ? "티커" : t === "quiz" ? "퀴즈" : t === "survey" ? "설문" : t === "numpad" ? "숫자패드" : t === "html" ? "HTML" : t === "calendar" ? "달력" : t === "weather" ? "날씨" : t === "chart" ? "차트" : t === "tabs" ? "탭메뉴" : t === "videolist" ? "동영상목록" : "상품그리드"}</button>
                    ))}
                    {tpl.pages[tplPage].components.map((c, ci) => (
                      <div key={c.id} id={`ec-${c.id}`} draggable
                        onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!dragId || dragId === c.id) return;
                          const arr = [...tpl.pages[tplPage].components];
                          const from = arr.findIndex((x) => x.id === dragId);
                          if (from < 0) return;
                          const [mv] = arr.splice(from, 1);
                          arr.splice(ci, 0, mv);
                          updPage(tpl.pages[tplPage].id, { components: arr });
                          setDragId(null);
                        }}
                        className="border rounded-lg p-2 grid gap-1 bg-white" style={{ opacity: dragId === c.id ? 0.5 : 1, outline: selComp === c.id ? "3px solid #C2410C" : "none" }}
                        onClick={() => setSelComp(c.id)}>
                        <div className="flex items-center gap-2">
                          <span className="cursor-move text-gray-400" title="드래그로 순서 변경">⠿</span>
                          <b className="text-[clamp(13px,2vw,15px)]">{c.type}</b>
                          <button className={btn} onClick={() => {
                            const arr = [...tpl.pages[tplPage].components];
                            if (ci > 0) { [arr[ci - 1], arr[ci]] = [arr[ci], arr[ci - 1]]; updPage(tpl.pages[tplPage].id, { components: arr }); }
                          }} aria-label="위로">↑</button>
                          <button className={btn} onClick={() => {
                            const arr = [...tpl.pages[tplPage].components];
                            if (ci < arr.length - 1) { [arr[ci + 1], arr[ci]] = [arr[ci], arr[ci + 1]]; updPage(tpl.pages[tplPage].id, { components: arr }); }
                          }} aria-label="아래로">↓</button>
                          <button className={btn} onClick={() => updPage(tpl.pages[tplPage].id, { components: tpl.pages[tplPage].components.filter((x) => x.id !== c.id) })}>삭제</button>
                          <button className={btn} onClick={() => {
                            const copy = JSON.parse(JSON.stringify(c));
                            copy.id = `c${Date.now()}`;
                            const arr = [...tpl.pages[tplPage].components];
                            arr.splice(ci + 1, 0, copy);
                            updPage(tpl.pages[tplPage].id, { components: arr });
                            notify("위젯 복제됨");
                          }}>📋 복제</button>
                        </div>
                        <div className="flex gap-1 items-center text-[clamp(12px,1.5vw,14px)] text-gray-600">
                          <span>배치:</span>
                          <input className="min-h-[48px] border rounded-lg px-2 w-20" placeholder="위 여백" value={String(c.props.mt ?? 0)}
                            onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { mt: e.target.value })} aria-label="위쪽 여백(px)" />
                          <select className="min-h-[48px] border rounded-lg px-2" value={String(c.props.align ?? "")}
                            onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { align: e.target.value })} aria-label="정렬">
                            <option value="">늘리기</option>
                            <option value="left">왼쪽</option>
                            <option value="center">가운데</option>
                            <option value="right">오른쪽</option>
                          </select>
                          <select className="min-h-[48px] border rounded-lg px-2" value={String(c.props.w ?? "full")}
                            onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { w: e.target.value })} aria-label="너비">
                            <option value="full">전체 너비</option>
                            <option value="auto">내용 너비</option>
                          </select>
                        </div>
                        {c.type === "text" && (<>
                          <input className={input} placeholder="내용" value={String(c.props.content ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { content: e.target.value })} />
                          <div className="flex gap-1">
                            <input className={`${input} flex-1`} placeholder="크기" value={String(c.props.size ?? 20)} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { size: e.target.value })} aria-label="글자 크기" />
                            <input type="color" className="min-h-[48px] min-w-[48px]" value={String(c.props.color ?? "#111111")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { color: e.target.value })} aria-label="글자색" />
                            <input type="color" className="min-h-[48px] min-w-[48px]" value={String(c.props.bg ?? "#ffffff")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { bg: e.target.value })} aria-label="배경색" />
                          </div>
                          <input className={input} placeholder="TTS 안내 (비우면 경고)" value={String(c.props.tts ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { tts: e.target.value })} />
                        </>)}
                        {c.type === "button" && (<>
                          <input className={input} placeholder="라벨" value={String(c.props.label ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { label: e.target.value })} />
                          <input className={input} placeholder="이동 대상 (페이지ID 또는 /경로 또는 https://…)" value={String(c.props.target ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { target: e.target.value })} />
                          <div className="flex gap-1">
                            <input type="color" className="min-h-[48px] min-w-[48px]" value={String(c.props.bg ?? "#C2410C")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { bg: e.target.value })} aria-label="버튼 배경" />
                            <input type="color" className="min-h-[48px] min-w-[48px]" value={String(c.props.color ?? "#FFFFFF")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { color: e.target.value })} aria-label="버튼 글자색" />
                            <input className={`${input} flex-1`} placeholder="높이" value={String(c.props.height ?? 64)} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { height: e.target.value })} aria-label="버튼 높이" />
                          </div>
                          <input className={input} placeholder="TTS 안내" value={String(c.props.tts ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { tts: e.target.value })} />
                        </>)}
                        {c.type === "image" && (<>
                          <input className={input} placeholder="이미지 URL (/uploads/… 또는 https://…)" value={String(c.props.src ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { src: e.target.value })} />
                          <input className={input} placeholder="대체 텍스트" value={String(c.props.alt ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { alt: e.target.value })} />
                        </>)}
                        {c.type === "video" && (<>
                          <input className={input} placeholder="동영상 URL" value={String(c.props.src ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { src: e.target.value })} />
                          <input className={input} placeholder="자막" value={String(c.props.subtitle ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { subtitle: e.target.value })} />
                        </>)}
                        {c.type === "html" && (
                          <textarea className={`${input} min-h-[120px] font-mono`} placeholder="<div>HTML 입력 (script·form 실행 안됨)</div>" value={String(c.props.html ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { html: e.target.value })} aria-label="HTML 코드" />
                        )}
                        {c.type === "nav" && (<>
                          <input className={input} placeholder="라벨" value={String(c.props.label ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { label: e.target.value })} />
                          <input className={input} placeholder="이동 대상 (/ 또는 /경로)" value={String(c.props.target ?? "/")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { target: e.target.value })} />
                        </>)}
                        {c.type === "appbar" && (<>
                          <input className={input} placeholder="제목" value={String(c.props.title ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { title: e.target.value })} />
                          <div className="flex gap-1">
                            <input type="color" className="min-h-[48px] min-w-[48px]" value={String(c.props.bg ?? "#0d9488")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { bg: e.target.value })} aria-label="앱바 배경" />
                            <input type="color" className="min-h-[48px] min-w-[48px]" value={String(c.props.color ?? "#FFFFFF")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { color: e.target.value })} aria-label="앱바 글자색" />
                          </div>
                        </>)}
                        {c.type === "progress" && (<>
                          <input className={input} placeholder="라벨" value={String(c.props.label ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { label: e.target.value })} />
                          <div className="flex gap-1">
                            <input className={`${input} flex-1`} placeholder="값" value={String(c.props.value ?? 30)} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { value: e.target.value })} aria-label="진행 값" />
                            <input className={`${input} flex-1`} placeholder="최대" value={String(c.props.max ?? 100)} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { max: e.target.value })} aria-label="최대값" />
                          </div>
                        </>)}
                        {c.type === "ticker" && (<>
                          <input className={input} placeholder="공지 내용" value={String(c.props.text ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { text: e.target.value })} />
                        </>)}
                        {c.type === "quiz" && (<>
                          <input className={input} placeholder="질문" value={String(c.props.question ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { question: e.target.value })} />
                          <input className={input} placeholder="선택지 (쉼표 구분, 최대 4)" value={Array.isArray(c.props.options) ? (c.props.options as string[]).join(",") : ""} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { options: e.target.value.split(",").map((s) => s.trim()).slice(0, 4) })} />
                          <input className={input} placeholder="정답 번호 (0부터)" value={String(c.props.answer ?? 0)} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { answer: e.target.value })} aria-label="정답 번호" />
                        </>)}
                        {c.type === "survey" && (
                          <input className={input} placeholder="질문" value={String(c.props.question ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { question: e.target.value })} />
                        )}
                        {c.type === "numpad" && (<>
                          <input className={input} placeholder="안내 문구" value={String(c.props.label ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { label: e.target.value })} />
                          <input className={input} placeholder="확인 후 이동 (페이지ID, 비우면 없음)" value={String(c.props.target ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { target: e.target.value })} />
                        </>)}
                        {c.type === "productgrid" && (<>
                          <select className={input} value={String(c.props.datasetId ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { datasetId: e.target.value })} aria-label="데이터셋">
                            <option value="">데이터셋 선택</option>
                            {dss.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.total}행)</option>)}
                          </select>
                          <div className="flex gap-1">
                            <input className={`${input} flex-1`} placeholder="제목 필드" value={String(c.props.titleField ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { titleField: e.target.value })} aria-label="제목 필드" />
                            <input className={`${input} flex-1`} placeholder="가격 필드" value={String(c.props.priceField ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { priceField: e.target.value })} aria-label="가격 필드" />
                            <input className={`${input} flex-1`} placeholder="이미지 필드" value={String(c.props.imageField ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { imageField: e.target.value })} aria-label="이미지 필드" />
                          </div>
                        </>)}
                        {c.type === "calendar" && (
                          <p className="text-[clamp(12px,1.5vw,14px)] text-gray-500">달력 (당월 자동 표시, 설정 불필요)</p>
                        )}
                        {c.type === "weather" && (<>
                          <input className={input} placeholder="라벨" value={String(c.props.label ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { label: e.target.value })} />
                          <div className="flex gap-1">
                            <input className={`${input} flex-1`} placeholder="위도" value={String(c.props.lat ?? 37.56)} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { lat: e.target.value })} aria-label="위도" />
                            <input className={`${input} flex-1`} placeholder="경도" value={String(c.props.lon ?? 126.97)} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { lon: e.target.value })} aria-label="경도" />
                          </div>
                        </>)}
                        {c.type === "chart" && (<>
                          <input className={input} placeholder="제목" value={String(c.props.title ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { title: e.target.value })} />
                          <select className={input} value={String(c.props.datasetId ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { datasetId: e.target.value })} aria-label="차트 데이터셋">
                            <option value="">데이터셋 선택</option>
                            {dss.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.total}행)</option>)}
                          </select>
                          <div className="flex gap-1">
                            <input className={`${input} flex-1`} placeholder="라벨 필드" value={String(c.props.labelField ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { labelField: e.target.value })} aria-label="라벨 필드" />
                            <input className={`${input} flex-1`} placeholder="값 필드" value={String(c.props.valueField ?? "")} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { valueField: e.target.value })} aria-label="값 필드" />
                          </div>
                        </>)}
                        {c.type === "tabs" && (
                          <input className={input} placeholder="탭 (쉼표 구분)" value={Array.isArray(c.props.items) ? (c.props.items as string[]).join(",") : ""} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8) })} />
                        )}
                        {c.type === "videolist" && (
                          <textarea className={`${input} min-h-[80px] font-mono`} placeholder="동영상 URL (줄바꿈 구분, 최대 6)" value={Array.isArray(c.props.urls) ? (c.props.urls as string[]).join("\n") : ""} onChange={(e) => updComp(tpl.pages[tplPage].id, c.id, { urls: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6) })} aria-label="동영상 URL 목록" />
                        )}
                        {c.type === "button" && (
                          <div className="grid gap-1 border rounded-lg p-2">
                            <b className="text-[clamp(12px,1.5vw,14px)]">클릭 액션 체인 (순차 실행, 비우면 target 이동)</b>
                            {((c.props.actions as { type: string; text?: string; target?: string; url?: string; key?: string; value?: string }[]) || []).map((a, ai) => (
                              <div key={ai} className="flex gap-1">
                                <select className={`${input} flex-1`} value={a.type} onChange={(e) => {
                                  const arr = [...(((c.props.actions as unknown[]) || []) as { type: string }[])];
                                  arr[ai] = { ...arr[ai], type: e.target.value };
                                  updComp(tpl.pages[tplPage].id, c.id, { actions: arr });
                                }} aria-label="액션 종류">
                                  {["NAVIGATE", "POPUP", "TOAST", "SPEAK", "API_CALL", "STATE_UPDATE", "STATE_RESET", "DRIVER_EXECUTE", "WAIT_HARDWARE"].map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input className={`${input} flex-[2]`} placeholder="text/target/url/key/driverId (종류별)" value={String(a.text ?? a.target ?? a.url ?? a.key ?? (a as { driverId?: string }).driverId ?? (a as { hardware?: string }).hardware ?? "")}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const arr = [...(((c.props.actions as unknown[]) || []) as Record<string, unknown>[])];
                                    const cur = { ...(arr[ai] as Record<string, unknown>) };
                                    if (a.type === "NAVIGATE") cur.target = v;
                                    else if (a.type === "API_CALL") cur.url = v;
                                    else if (a.type === "STATE_UPDATE") cur.key = v;
                                    else if (a.type === "DRIVER_EXECUTE") cur.driverId = v;
                                    else if (a.type === "WAIT_HARDWARE") cur.hardware = v;
                                    else cur.text = v;
                                    arr[ai] = cur;
                                    updComp(tpl.pages[tplPage].id, c.id, { actions: arr });
                                  }} aria-label="액션 값" />
                                <button type="button" className={btn} onClick={() => {
                                  const arr = (((c.props.actions as unknown[]) || []) as unknown[]).filter((_, j) => j !== ai);
                                  updComp(tpl.pages[tplPage].id, c.id, { actions: arr });
                                }} aria-label="액션 삭제">✕</button>
                              </div>
                            ))}
                            <button type="button" className={btn} onClick={() => {
                              const arr = [...(((c.props.actions as unknown[]) || []) as unknown[]), { type: "NAVIGATE", target: "" }];
                              updComp(tpl.pages[tplPage].id, c.id, { actions: arr });
                            }}>+ 액션</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "stats" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">현황 대시보드</h1>
            <div className="flex gap-2 items-center mb-4">
              <select className={input} value={statDays} onChange={(e) => { const d = Number(e.target.value); setStatDays(d); loadStats(d); }} aria-label="조회 기간">
                <option value={7}>최근 7일</option>
                <option value={30}>최근 30일</option>
              </select>
              <button className={btn} onClick={() => loadStats(statDays)}>새로고침</button>
            </div>
            {!stats && <button className={primary} onClick={() => loadStats(statDays)}>현황 불러오기</button>}
            {stats && (<>
              <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">일별 이용 (시작/완료, 오류 {stats.errors}건)</h2>
              <div className="bg-white border rounded-2xl p-4 mb-4 flex items-end gap-1 h-40" role="img" aria-label="일별 이용 막대 차트">
                {(stats.perDay || []).map((d) => {
                  const max = Math.max(1, ...stats.perDay.map((x) => x.starts));
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: 시작 ${d.starts}, 완료 ${d.completes}`}>
                      <div className="w-full bg-orange-200 rounded-t" style={{ height: `${Math.round((d.starts / max) * 70)}%`, minHeight: d.starts ? 4 : 0 }} />
                      <div className="w-full bg-orange-700 rounded-t" style={{ height: `${Math.round((d.completes / max) * 30)}%`, minHeight: d.completes ? 4 : 0 }} />
                      <span className="text-[10px] text-gray-500">{String(d.date).slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">앱별 완료율</h2>
              <ul className="grid gap-2 mb-4">
                {(stats.perApp || []).map((a) => (
                  <li key={a.slug} className="bg-white border rounded-lg p-3 text-[clamp(14px,2vw,16px)]">
                    <b>{a.slug}</b> — 시작 {a.starts} · 완료 {a.completes} · <b>{a.rate}%</b>
                  </li>
                ))}
                {(stats.perApp || []).length === 0 && <li className="text-gray-500">이벤트 없음 — 키오스크에서 템플릿을 실행하면 집계됩니다</li>}
              </ul>
              <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">설문 문항별 결과</h2>
              <ul className="grid gap-2 mb-4">
                {((stats as Stats & { surveyDetail?: { appSlug: string; question: string; c5: number; c3: number; c1: number; n: number; avg: number }[] }).surveyDetail || []).map((s, i) => (
                  <li key={i} className="bg-white border rounded-lg p-3 text-[clamp(14px,2vw,16px)]">
                    <b>{s.appSlug}</b> — {s.question}
                    <span className="block text-gray-600">😊{s.c5} 😐{s.c3} 😞{s.c1} · 평균 {s.avg}점 · {s.n}건</span>
                  </li>
                ))}
              </ul>
              <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">최근 오류</h2>
              <ul className="grid gap-2 mb-4">
                {((stats as Stats & { recentErrors?: { deviceUuid: string; appSlug: string; at: string }[] }).recentErrors || []).map((e, i) => (
                  <li key={i} className="bg-white border rounded-lg p-3 text-[clamp(12px,1.5vw,14px)]">
                    <b className="text-red-700">오류</b> {e.appSlug} · <span className="font-mono">{String(e.deviceUuid).slice(0, 13)}…</span> · {new Date(e.at).toLocaleString("ko-KR")}
                  </li>
                ))}
                {(((stats as Stats & { recentErrors?: unknown[] }).recentErrors) || []).length === 0 && <li className="text-gray-500">오류 없음</li>}
              </ul>
              <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">기기별</h2>
              <ul className="grid gap-2">
                {(stats.perDevice || []).map((d) => (
                  <li key={d.uuid} className="bg-white border rounded-lg p-3 text-[clamp(12px,1.5vw,14px)] font-mono break-all">
                    {String(d.uuid).slice(0, 18)}… — 시작 {d.starts} · 완료 {d.completes}
                  </li>
                ))}
              </ul>
            </>)}
          </section>
        )}

        {tab === "permissions" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">권한 관리</h1>
            <form onSubmit={grant} className="grid gap-2 max-w-lg bg-white border rounded-2xl p-4 mb-4">
              <input className={input} placeholder="email (예: user@rustkorea.cloud)" value={perm.email} onChange={(e) => setPerm({ ...perm, email: e.target.value })} />
              <input className={input} placeholder="slug (예: library)" value={perm.slug} onChange={(e) => setPerm({ ...perm, slug: e.target.value })} />
              <select className={input} value={perm.accessLevel} onChange={(e) => setPerm({ ...perm, accessLevel: e.target.value })} aria-label="권한">
                <option value="VIEW">VIEW</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button className={primary}>권한 부여·변경</button>
            </form>
            <ul className="grid gap-2">
              {perms.map((p, i) => (
                <li key={`${p.email}-${p.slug}-${i}`} className="bg-white border rounded-lg p-3 flex items-center gap-2 text-[clamp(14px,2vw,16px)]">
                  <span className="flex-1">{p.email} — {p.slug} · {p.accessLevel}</span>
                  <button className={btn} onClick={() => revoke(p.email, p.slug)}>회수</button>
                </li>
              ))}
              {perms.length === 0 && <li className="text-gray-500">부여된 권한 없음 (데모: user@rustkorea.cloud/User123! 로 library만 확인 가능)</li>}
            </ul>
          </section>
        )}

        {tab === "settings" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">플랫폼 설정</h1>
            <div className="grid gap-2 max-w-lg bg-white border rounded-2xl p-4 mb-4">
              <label className="text-[clamp(14px,2vw,16px)]">플랫폼 이름 (런처 타이틀)
                <input className={`${input} w-full mt-1`} value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} />
              </label>
              <label className="text-[clamp(14px,2vw,16px)]">브랜드 색상
                <span className="flex gap-2 mt-1">
                  <input type="color" className="min-h-[48px] min-w-[48px]" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} aria-label="브랜드 색상 선택" />
                  <input className={`${input} flex-1`} value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} />
                </span>
              </label>
              <label className="text-[clamp(14px,2vw,16px)]">로고 URL
                <input className={`${input} w-full mt-1`} value={settings.logoUrl} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} />
              </label>
              <label className="text-[clamp(14px,2vw,16px)]">공지사항 (런처 상단 배너, 비우면 숨김)
                <input className={`${input} w-full mt-1`} value={settings.announcement} onChange={(e) => setSettings({ ...settings, announcement: e.target.value })} />
              </label>
              <label className="text-[clamp(14px,2vw,16px)]">키오스크 유휴 타임아웃 (분, 1~30)
                <input type="number" min={1} max={30} className={`${input} w-full mt-1`} value={settings.idleTimeoutMin} onChange={(e) => setSettings({ ...settings, idleTimeoutMin: Number(e.target.value) })} />
              </label>
              <label className="text-[clamp(14px,2vw,16px)]">런처 배경
                <span className="flex gap-2 mt-1">
                  <select className={input} value={settings.backgroundType} onChange={(e) => setSettings({ ...settings, backgroundType: e.target.value })} aria-label="배경 방식">
                    <option value="color">단색(RGB)</option>
                    <option value="image">이미지</option>
                  </select>
                  {settings.backgroundType === "color" ? (
                    <span className="flex gap-2 flex-1">
                      <input type="color" className="min-h-[48px] min-w-[48px]" value={settings.backgroundColor} onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })} aria-label="배경 색상 선택" />
                      <input className={`${input} flex-1`} value={settings.backgroundColor} onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })} />
                    </span>
                  ) : (
                    <input className={`${input} flex-1`} placeholder="/uploads/배너.png 또는 https://…" value={settings.backgroundImage} onChange={(e) => setSettings({ ...settings, backgroundImage: e.target.value })} />
                  )}
                </span>
              </label>
              {settings.backgroundType === "image" && (
                <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">배경 이미지 업로드
                  <input type="file" accept="image/png,image/jpeg,image/webp" className={`${input} pt-2`}
                    disabled={uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadIcon(f);
                      if (url) { setSettings((s) => ({ ...s, backgroundImage: url })); saveSettings({ backgroundImage: url }, "배경 저장됨 → 런처에 반영"); }
                      e.target.value = "";
                    }} />
                </label>
              )}
              <button className={primary} onClick={() => saveSettings({})}>설정 저장 → 런처에 반영</button>
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">그리드 밀도 (한 화면 최대 아이콘)</h2>
            <div className="max-w-lg bg-white border rounded-2xl p-4 mb-4 grid gap-2">
              <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">표시 모드
                <select className={input} value={settings.gridDensity} onChange={(e) => setSettings({ ...settings, gridDensity: e.target.value })} aria-label="그리드 밀도">
                  <option value="comfortable">여유롭게 (카드+이름+설명)</option>
                  <option value="compact">빽빽하게 (아이콘 위주, 한 화면 최대)</option>
                </select>
              </label>
              {(["mobile", "tablet", "desktop", "kiosk"] as const).map((k) => (
                <label key={k} className="grid gap-1 text-[clamp(14px,2vw,16px)]">
                  {k === "mobile" ? "모바일 열수" : k === "tablet" ? "태블릿 열수" : k === "desktop" ? "데스크탑 열수" : "키오스크(55인치·4K) 열수"}
                  <input type="number" min={1} max={12} className={input}
                    value={settings.gridCols[k]} onChange={(e) => setSettings({ ...settings, gridCols: { ...settings.gridCols, [k]: Number(e.target.value) } })}
                    aria-label={`${k} 열수`} />
                </label>
              ))}
              <label className="flex items-center gap-2 min-h-[48px] text-[clamp(14px,2vw,16px)]">
                <input type="checkbox" className="w-6 h-6" checked={settings.showAppName} onChange={(e) => setSettings({ ...settings, showAppName: e.target.checked })} />
                앱 이름 표시
              </label>
              <button className={primary} onClick={() => saveSettings({ gridDensity: settings.gridDensity, gridCols: settings.gridCols, showAppName: settings.showAppName })}>그리드 저장 → 런처에 반영</button>
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">로고·PWA 아이콘</h2>
            <div className="max-w-lg bg-white border rounded-2xl p-4 mb-4 grid gap-2">
              <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">헤더 로고 URL
                <input className={`${input} w-full`} value={settings.logoUrl} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} />
              </label>
              <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">로고 이미지 업로드
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className={`${input} pt-2`}
                  disabled={uploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadIcon(f);
                    if (url) { setSettings((s) => ({ ...s, logoUrl: url })); saveSettings({ logoUrl: url }, "로고 저장됨 → 런처 헤더에 반영"); }
                    e.target.value = "";
                  }} />
              </label>
              <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">PWA 아이콘 (홈화면 설치용)
                <span className="flex gap-2 items-center">
                  {settings.pwaIconUrl && <img src={settings.pwaIconUrl} alt="PWA 아이콘 미리보기" width={48} height={48} className="w-12 h-12 object-contain border rounded-lg" />}
                  <input className={`${input} flex-1`} placeholder="/uploads/pwa.png" value={settings.pwaIconUrl} onChange={(e) => setSettings({ ...settings, pwaIconUrl: e.target.value })} aria-label="PWA 아이콘 URL" />
                </span>
              </label>
              <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">PWA 아이콘 업로드 (png 권장)
                <input type="file" accept="image/png,image/jpeg,image/webp" className={`${input} pt-2`}
                  disabled={uploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadIcon(f);
                    if (url) { setSettings((s) => ({ ...s, pwaIconUrl: url })); saveSettings({ pwaIconUrl: url }, "PWA 아이콘 저장됨"); }
                    e.target.value = "";
                  }} />
              </label>
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">관리자 메뉴 관리 (이름·순서)</h2>
            <div className="max-w-lg bg-white border rounded-2xl p-4 mb-4 grid gap-2">
              {(settings.adminMenu.length ? settings.adminMenu : DEFAULT_MENU).map((m, i, arr) => (
                <div key={m.id} className="flex items-center gap-1">
                  <input className={`${input} flex-1`} value={m.label}
                    onChange={(e) => {
                      const next = arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x);
                      setSettings((s) => ({ ...s, adminMenu: next }));
                    }} aria-label={`${m.id} 메뉴명`} />
                  <button className={btn} onClick={() => {
                    if (i === 0) return;
                    const next = [...arr]; [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    saveSettings({ adminMenu: next }, "메뉴 순서 저장됨");
                  }} aria-label="위로">↑</button>
                  <button className={btn} onClick={() => {
                    if (i === arr.length - 1) return;
                    const next = [...arr]; [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    saveSettings({ adminMenu: next }, "메뉴 순서 저장됨");
                  }} aria-label="아래로">↓</button>
                </div>
              ))}
              <button className={primary} onClick={() => {
                const next = (settings.adminMenu.length ? settings.adminMenu : DEFAULT_MENU).map((m) => ({ ...m }));
                saveSettings({ adminMenu: next }, "메뉴 이름 저장됨");
              }}>메뉴 이름 저장</button>
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">수집 보안</h2>
            <div className="max-w-lg bg-white border rounded-2xl p-4 mb-4">
              <label className="flex items-center gap-2 min-h-[48px] text-[clamp(14px,2vw,16px)]">
                <input type="checkbox" className="w-6 h-6" checked={settings.requireApprovedDevice}
                  onChange={(e) => saveSettings({ requireApprovedDevice: e.target.checked }, e.target.checked ? "승인된 장비만 수집" : "전체 수집으로 변경")} />
                승인된 장비의 이벤트만 수집 (미승인 차단)
              </label>
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">알림 (에러 발생 시 웹훅)</h2>
            <div className="max-w-lg bg-white border rounded-2xl p-4 mb-4 grid gap-2">
              <input className={input} placeholder="웹훅 URL (비우면 내부 보관함만)" value={(settings.notification as { webhookUrl?: string } | undefined)?.webhookUrl || ""}
                onChange={(e) => setSettings({ ...settings, notification: { webhookUrl: e.target.value } })} aria-label="웹훅 URL" />
              <div className="flex gap-2">
                <button className={primary} onClick={() => saveSettings({ notification: settings.notification } as Partial<Settings>, "알림 설정 저장됨")}>알림 저장</button>
                <button className={btn} onClick={async () => {
                  const r = await fetch("/api/admin/outbox/test", { method: "POST" });
                  const j = await r.json().catch(() => ({}));
                  notify(r.ok && j.success ? `테스트 발송됨 (전송 ${j.data?.sent ? "성공" : "보관"})` : "실패", r.ok && j.success);
                  load();
                }}>테스트 발송</button>
              </div>
              <ul className="grid gap-1">
                {outbox.map((o) => (
                  <li key={o.id} className="text-[clamp(12px,1.5vw,14px)] border-b py-1">[{o.kind}] {o.text} · {new Date(o.at).toLocaleString("ko-KR")} {o.sent === true ? "(전송됨)" : o.sent === false ? "(보관)" : ""}</li>
                ))}
              </ul>
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">허용 도메인 (앱 등록 Allowlist)</h2>
            <div className="max-w-lg bg-white border rounded-2xl p-4 mb-4">
              <p className="text-[clamp(12px,1.5vw,14px)] text-gray-500 mb-2">여기에 없는 도메인의 앱 주소는 등록이 차단됩니다. (예: kakaotaxi.com)</p>
              <ul className="grid gap-1 mb-2">
                {(settings.allowedDomains || []).map((d) => (
                  <li key={d} className="flex items-center gap-2 text-[clamp(14px,2vw,16px)] border-b py-2">
                    <span className="flex-1">{d}</span>
                    <button className={btn} onClick={() => saveSettings({ allowedDomains: (settings.allowedDomains || []).filter((x) => x !== d) }, "허용 도메인 삭제됨")}>삭제</button>
                  </li>
                ))}
              </ul>
              <form onSubmit={(e) => { e.preventDefault(); const v = newDomain.trim(); if (!v) return; saveSettings({ allowedDomains: [...(settings.allowedDomains || []), v] }, "허용 도메인 추가됨"); setNewDomain(""); }} className="flex gap-2">
                <input className={`${input} flex-1`} placeholder="example.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} aria-label="새 허용 도메인" />
                <button className={primary}>추가</button>
              </form>
            </div>
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">타이틀 미리보기</h2>
            <div className="max-w-lg border rounded-2xl p-4 bg-white">
              <b className="text-[clamp(24px,3vw,36px)]" style={{ color: settings.primaryColor }}>{settings.platformName || "(이름 없음)"}</b>
              {settings.announcement && <p className="mt-2 text-[clamp(14px,2vw,16px)] rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">{settings.announcement}</p>}
            </div>
          </section>
        )}

        {tab === "audit" && (
          <section>
            <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">감사 로그</h1>
            <input className="min-h-[48px] w-full max-w-md border rounded-lg px-3 mb-3 text-[clamp(14px,2vw,16px)] bg-white" placeholder="필터 (예: app.register, admin@…)" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} aria-label="감사 로그 필터" />
            <ul className="grid gap-1">
              {audit.filter((a) => !auditFilter.trim() || `${a.action} ${a.actorId} ${a.target ?? ""} ${a.result}`.includes(auditFilter.trim())).map((a) => (
                <li key={a.id} className="bg-white text-[clamp(12px,1.5vw,14px)] border-b py-2 px-2">
                  {new Date(a.createdAt).toLocaleString("ko-KR")} — {a.action} — {a.target ?? "-"} — {a.result}
                </li>
              ))}
              {audit.length === 0 && <li className="text-gray-500">기록 없음</li>}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
