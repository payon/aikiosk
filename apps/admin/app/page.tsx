"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PreviewGrid, type AppRegistry } from "@/components/PreviewGrid";

const LAUNCHER = process.env.NEXT_PUBLIC_LAUNCHER_URL || "/";
type Tab = "overview" | "apps" | "categories" | "users" | "permissions" | "settings" | "audit";

interface AuditRow { id: string; actorId: string; action: string; target?: string | null; result: string; createdAt: string; }
interface Perm { email: string; slug: string; accessLevel: string; }
interface Settings { platformName: string; primaryColor: string; logoUrl: string; announcement: string; idleTimeoutMin: number; menuOrder: string[]; backgroundType: string; backgroundColor: string; backgroundImage: string; allowedDomains: string[]; }
interface AppUser { id: string; email: string; role: string; createdAt: string; }

const EMPTY_APP: { name: string; slug: string; targetUrl: string; iconUrl: string; description: string; category: string; openMode: "embed" | "direct"; bgType: string; bgColor: string; bgImage: string } = { name: "", slug: "", targetUrl: "", iconUrl: "/icons/app.svg", description: "", category: "전체", openMode: "embed", bgType: "color", bgColor: "#FFFFFF", bgImage: "" };

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [apps, setApps] = useState<AppRegistry[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [settings, setSettings] = useState<Settings>({ platformName: "", primaryColor: "#C2410C", logoUrl: "/logo.svg", announcement: "", idleTimeoutMin: 3, menuOrder: [], backgroundType: "color", backgroundColor: "#FFF7ED", backgroundImage: "", allowedDomains: [] });
  const [newDomain, setNewDomain] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
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
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) router.replace("/login");
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
        allowedDomains: j.data.allowedDomains ?? []
      });
    }).catch(() => {});
    fetch("/api/admin/users").then(async (r) => {
      const j = await r.json();
      if (j.success) setUsers(j.data);
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
      body: JSON.stringify({ id: editing.id, name: editing.name, slug, targetUrl: editing.targetUrl, iconUrl: editing.iconUrl, description: editing.description, category: editing.category, stripPrefix: !!editing.stripPrefix, openMode: editing.openMode || "embed", bgType: editing.bgType || "color", bgColor: editing.bgColor || "#FFFFFF", bgImage: editing.bgImage || "" })
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
  const mainTabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "개요" },
    { id: "apps", label: "앱 관리" },
    { id: "categories", label: "카테고리" }
  ];
  const moreTabs: { id: Tab; label: string }[] = [
    { id: "users", label: "사용자" },
    { id: "permissions", label: "권한" },
    { id: "settings", label: "설정" },
    { id: "audit", label: "감사 로그" }
  ];
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
                  <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">열기 방식
                    <select className={input} value={editing.openMode || "embed"} onChange={(e) => setEditing({ ...editing, openMode: e.target.value as "embed" | "direct" })} aria-label="열기 방식">
                      <option value="embed">통합 보기 (/apps/슬러그)</option>
                      <option value="direct">직접 이동 (targetUrl로 이동)</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-[clamp(14px,2vw,16px)]">카드 배경
                    <span className="flex gap-2">
                      <select className={input} value={editing.bgType || "color"} onChange={(e) => setEditing({ ...editing, bgType: e.target.value })} aria-label="카드 배경 방식">
                        <option value="color">단색(RGB)</option>
                        <option value="image">이미지</option>
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
                      if (url) setSettings((s) => ({ ...s, backgroundImage: url }));
                      e.target.value = "";
                    }} />
                </label>
              )}
              <button className={primary} onClick={() => saveSettings({})}>설정 저장 → 런처에 반영</button>
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
