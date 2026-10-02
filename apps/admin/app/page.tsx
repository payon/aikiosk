"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PreviewGrid, type AppRegistry } from "@/components/PreviewGrid";

const LAUNCHER = process.env.NEXT_PUBLIC_LAUNCHER_URL || "/";
type Tab = "overview" | "apps" | "categories" | "permissions" | "settings" | "audit";

interface AuditRow { id: string; actorId: string; action: string; target?: string | null; result: string; createdAt: string; }
interface Perm { email: string; slug: string; accessLevel: string; }
interface Settings { platformName: string; primaryColor: string; logoUrl: string; announcement: string; idleTimeoutMin: number; menuOrder: string[]; }

const EMPTY_APP: { name: string; slug: string; targetUrl: string; iconUrl: string; description: string; category: string; openMode: "embed" | "direct" } = { name: "", slug: "", targetUrl: "", iconUrl: "/icons/app.svg", description: "", category: "전체", openMode: "embed" };

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [apps, setApps] = useState<AppRegistry[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [settings, setSettings] = useState<Settings>({ platformName: "", primaryColor: "#C2410C", logoUrl: "/logo.svg", announcement: "", idleTimeoutMin: 3, menuOrder: [] });
  const [form, setForm] = useState(EMPTY_APP);
  const [editing, setEditing] = useState<(AppRegistry & { id: string }) | null>(null);
  const [perm, setPerm] = useState({ email: "", slug: "", accessLevel: "VIEW" });
  const [rename, setRename] = useState({ from: "", to: "" });
  const [moveTo, setMoveTo] = useState("전체");
  const [msg, setMsg] = useState("");

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
        idleTimeoutMin: j.data.idleTimeoutMin ?? 3, menuOrder: j.data.menuOrder ?? []
      });
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  async function api(path: string, init?: RequestInit) {
    const r = await fetch(path, init);
    const j = await r.json().catch(() => ({ success: false, error: { message: r.statusText } }));
    return { ok: r.ok && j.success, j };
  }
  async function saveSettings(patch: Partial<Settings>, done = "설정 저장됨 → 런처에 반영") {
    const next = { ...settings, ...patch };
    const { ok, j } = await api("/api/admin/settings", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ platformName: next.platformName, primaryColor: next.primaryColor, logoUrl: next.logoUrl, announcement: next.announcement, idleTimeoutMin: Number(next.idleTimeoutMin), menuOrder: next.menuOrder })
    });
    setMsg(ok ? done : (j.error?.message ?? "실패"));
    if (ok) setSettings(next);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await api("/api/admin/apps", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, displayOrder: apps.length, isActive: true })
    });
    setMsg(ok ? "등록됨 → 런처에 즉시 반영" : (j.error?.message ?? "실패"));
    if (ok) { setForm(EMPTY_APP); load(); }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { ok, j } = await api("/api/admin/apps", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: editing.id, name: editing.name, slug: editing.slug, targetUrl: editing.targetUrl, iconUrl: editing.iconUrl, description: editing.description, category: editing.category, stripPrefix: !!editing.stripPrefix, openMode: editing.openMode || "embed" })
    });
    setMsg(ok ? "수정됨 → 런처에 즉시 반영" : (j.error?.message ?? "실패"));
    if (ok) { setEditing(null); load(); }
  }

  async function patch(id: string, data: Partial<AppRegistry>) {
    await api("/api/admin/apps", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    load();
  }

  async function remove(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/admin/apps?id=${id}`, { method: "DELETE" });
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
    setMsg(ok ? "권한 부여됨" : (j.error?.message ?? "실패"));
    if (ok) load();
  }

  async function revoke(email: string, slug: string) {
    if (!confirm(`${email} / ${slug} 권한을 회수할까요?`)) return;
    await fetch(`/api/admin/permissions?email=${encodeURIComponent(email)}&slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    load();
  }

  async function renameCat(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await api("/api/admin/categories", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(rename)
    });
    setMsg(ok ? `카테고리 변경됨 (${j.data?.renamed ?? 0}개 앱)` : (j.error?.message ?? "실패"));
    if (ok) { setRename({ from: "", to: "" }); load(); }
  }

  async function deleteCat(name: string) {
    if (!confirm(`카테고리 "${name}" 삭제 — 소속 앱은 "${moveTo}"로 이동합니다. 계속할까요?`)) return;
    const { ok, j } = await api(`/api/admin/categories?from=${encodeURIComponent(name)}&moveTo=${encodeURIComponent(moveTo)}`, { method: "DELETE" });
    setMsg(ok ? `삭제됨 (${j.data?.moved ?? 0}개 앱 이동)` : (j.error?.message ?? "실패"));
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
  const input = "min-h-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)] bg-white";
  const btn = "min-h-[48px] min-w-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)] bg-white";
  const primary = "min-h-[48px] rounded-lg bg-gray-900 text-white px-4 text-[clamp(16px,2vw,24px)]";
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "개요" },
    { id: "apps", label: "앱 관리" },
    { id: "categories", label: "카테고리·메뉴" },
    { id: "permissions", label: "권한" },
    { id: "settings", label: "설정" },
    { id: "audit", label: "감사 로그" }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <aside className="md:w-[280px] shrink-0 bg-gray-900 text-white p-4 flex md:flex-col gap-2 overflow-x-auto">
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

      <main className="flex-1 p-4 max-w-5xl">
        {msg && <p className="mb-3 text-[clamp(14px,2vw,16px)] bg-white border rounded-lg p-3" role="status">{msg}</p>}

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
              {(["name", "slug", "targetUrl", "iconUrl", "description", "category"] as const).map((k) => (
                <input key={k} className={input} placeholder={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              ))}
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
                  {(["name", "slug", "targetUrl", "iconUrl", "description", "category"] as const).map((k) => (
                    <input key={k} className={input} placeholder={k} value={editing[k] ?? ""} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
                  ))}
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
            <h2 className="text-[clamp(18px,2.5vw,24px)] font-bold mb-2">메뉴 순서</h2>
            <ul className="grid gap-2 mb-6">
              {cats.map((c) => (
                <li key={c} className="bg-white border rounded-lg p-3 flex items-center gap-2 text-[clamp(14px,2vw,16px)]">
                  <span className="flex-1"><b>{c}</b> — {apps.filter((a) => (a.category || "전체") === c).length}개 앱</span>
                  <button className={btn} onClick={() => menuMove(c, -1)} aria-label={`${c} 위로`}>↑</button>
                  <button className={btn} onClick={() => menuMove(c, 1)} aria-label={`${c} 아래로`}>↓</button>
                  <button className={btn} onClick={() => deleteCat(c)}>삭제</button>
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
              <button className={primary} onClick={() => saveSettings({})}>설정 저장 → 런처에 반영</button>
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
            <ul className="grid gap-1">
              {audit.map((a) => (
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
