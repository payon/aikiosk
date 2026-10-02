"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppGrid } from "@/components/AppGrid";
import { useDeviceType } from "@/hooks/useDeviceType";
import type { AppRegistry } from "@/types/app";

interface Props {
  initialApps: AppRegistry[];
  initialCats: { name: string; count: number }[];
  brand: string;
  announcement: string;
}

export function LauncherClient({ initialApps, initialCats, brand, announcement }: Props) {
  const router = useRouter();
  const device = useDeviceType();
  const [cat, setCat] = useState("전체");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return initialApps.filter((a) => {
      if (cat !== "전체" && (a.category || "전체") !== cat) return false;
      if (s && !(a.name + a.slug + (a.description ?? "")).toLowerCase().includes(s)) return false;
      return true;
    });
  }, [initialApps, q, cat]);

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h1 className="text-[clamp(24px,3vw,36px)] font-bold">{brand}</h1>
        <span className="text-[clamp(12px,1.5vw,18px)] text-gray-500">{device}</span>
      </div>
      {announcement && (
        <p role="status" className="mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 min-h-[48px] flex items-center text-[clamp(14px,2vw,16px)]">
          {announcement}
        </p>
      )}
      <nav className="flex gap-2 overflow-x-auto pb-2 mb-3" aria-label="카테고리 메뉴">
        {["전체", ...initialCats.map((c) => c.name)].map((c) => (
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
          onAppClick={(slug) => {
            const app = filtered.find((a) => a.slug === slug);
            if (app?.openMode === "direct") window.location.href = app.targetUrl;
            else router.push(`/apps/${slug}`);
          }}
        />
      )}
    </>
  );
}
