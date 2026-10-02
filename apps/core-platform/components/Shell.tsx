"use client";
import Link from "next/link";
import { ResponsiveSidebar } from "./ResponsiveSidebar";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useState } from "react";
import type { ShellLayoutProps } from "@/types/app";
import { useRouter } from "next/navigation";

export function Shell({ apps, currentSlug, brand, idleMin, children }: ShellLayoutProps) {
  useIdleTimer((idleMin && idleMin >= 1 && idleMin <= 30 ? idleMin : 3) * 60 * 1000);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur px-4 min-h-[48px] flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOpen(true)}
            className="md:hidden min-h-[48px] min-w-[48px] rounded-lg hover:bg-gray-100 text-[clamp(20px,3vw,28px)]"
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          <button onClick={() => router.push("/")} className="font-bold text-[clamp(16px,2vw,24px)] min-h-[48px]" aria-label="홈">
            {brand || "RustKorea Hub"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[clamp(12px,1.5vw,18px)] text-gray-500">SSO 연결됨</span>
          <button onClick={logout} className="min-h-[48px] min-w-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)]" aria-label="로그아웃">
            로그아웃
          </button>
        </div>
      </header>

      {/* 모바일 드로어 (하단 메뉴 대신) */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-label="메뉴">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-0 bottom-0 w-[280px] bg-white p-4 flex flex-col gap-1" aria-label="모바일 메뉴">
            <button onClick={() => setOpen(false)} className="min-h-[48px] self-end min-w-[48px] rounded-lg hover:bg-gray-100" aria-label="메뉴 닫기">✕</button>
            <Link href="/" onClick={() => setOpen(false)} className="min-h-[48px] flex items-center rounded-lg px-3 py-2 hover:bg-gray-100 text-[clamp(14px,2vw,16px)] font-bold">홈</Link>
            {apps.map((a) => (
              <Link key={a.id} href={`/apps/${a.slug}`} onClick={() => setOpen(false)}
                className="min-h-[48px] flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100 text-[clamp(14px,2vw,16px)]">
                <span aria-hidden>▦</span><span>{a.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}

      <div className="flex flex-1">
        <ResponsiveSidebar apps={apps} currentSlug={currentSlug} />
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
