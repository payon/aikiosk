"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppGrid, type GridConfig } from "@/components/AppGrid";
import type { AppRegistry } from "@/types/app";

interface Props {
  initialApps: AppRegistry[];
  initialCats: { name: string; count: number }[];
  announcement: string;
  grid: GridConfig;
}

export function LauncherClient({ initialApps, initialCats, announcement, grid }: Props) {
  const router = useRouter();
  const [apps, setApps] = useState(initialApps);
  const [cats, setCats] = useState(initialCats);
  const [announcementLive, setAnnouncement] = useState(announcement);
  const [cat, setCat] = useState("전체");
  const [q, setQ] = useState("");

  // 어드민 변경 즉시 반영: 플랫폼 설정 3초, 앱/카테고리 10초 폴링 (화면 가림 시 중단)
  useEffect(() => {
    let alive = true;
    const pollPlatform = async () => {
      try {
        const p = await fetch("/api/platform").then((r) => r.json());
        if (!alive || !p.success) return;
        if (typeof p.data?.announcement === "string" && p.data.announcement !== announcementLive) {
          setAnnouncement(p.data.announcement);
        }
        const sig = JSON.stringify([p.data?.platformName, p.data?.backgroundType, p.data?.backgroundColor, p.data?.backgroundImage, p.data?.gridDensity, p.data?.gridCols, p.data?.showAppName, p.data?.idleTimeoutMin, p.data?.logoUrl]);
        const prev = (window as unknown as { __platSig?: string }).__platSig;
        if (prev && prev !== sig) router.refresh();
        (window as unknown as { __platSig?: string }).__platSig = sig;
      } catch { /* ignore */ }
    };
    const pollApps = async () => {
      try {
        const [a, c] = await Promise.all([
          fetch("/api/apps").then((r) => r.json()),
          fetch("/api/categories").then((r) => r.json())
        ]);
        if (!alive) return;
        if (a.success) setApps(a.data);
        if (c.success) setCats(c.data);
      } catch { /* ignore */ }
    };
    const t1 = setInterval(() => { if (!document.hidden) pollPlatform(); }, 3000);
    const t2 = setInterval(() => { if (!document.hidden) pollApps(); }, 10000);
    return () => { alive = false; clearInterval(t1); clearInterval(t2); };
  }, [router, announcementLive]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return apps.filter((a) => {
      if (cat !== "전체" && (a.category || "전체") !== cat) return false;
      if (s && !(a.name + a.slug + (a.description ?? "")).toLowerCase().includes(s)) return false;
      return true;
    });
  }, [apps, q, cat]);

  return (
    <>
      {announcementLive && (
        <p role="status" className="mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 min-h-[48px] flex items-center text-[clamp(14px,2vw,16px)]">
          {announcementLive}
        </p>
      )}
      <nav className="flex gap-2 overflow-x-auto pb-2 mb-3" aria-label="카테고리 메뉴">
        {["전체", ...cats.map((c) => c.name)].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={`min-h-[48px] min-w-[48px] whitespace-nowrap rounded-full border px-4 text-[clamp(14px,2vw,16px)] ${
              cat === c ? "bg-orange-700 text-white border-orange-700 font-bold" : "bg-white hover:bg-gray-100"
            }`}
          >
            {c}
          </button>
        ))}
      </nav>
      <input
        className="min-h-[48px] w-full max-w-md border rounded-lg px-3 mb-4 text-[clamp(14px,2vw,16px)]"
        placeholder="앱 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="앱 검색"
      />
      {filtered.length === 0 && (
        <p className="text-[clamp(14px,2vw,16px)] text-gray-500">표시할 앱이 없습니다. 관리자에게 권한을 요청하세요.</p>
      )}
      {filtered.length > 0 && (
        <AppGrid
          apps={filtered}
          config={grid}
          onAppClick={(slug) => {
            const app = filtered.find((a) => a.slug === slug);
            if (app?.openMode === "direct") {
              // 새 탭: 런처 유지. 같은 탭: 히스토리에 남아 뒤로가기로 복귀.
              if (app.openTarget === "blank") window.open(app.targetUrl, "_blank", "noopener");
              else window.location.href = app.targetUrl;
            } else router.push(`/apps/${slug}`);
          }}
        />
      )}
    </>
  );
}
