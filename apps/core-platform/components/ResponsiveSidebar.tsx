"use client";
import Link from "next/link";
import type { AppRegistry } from "@/types/app";

export interface ResponsiveSidebarProps {
  apps: AppRegistry[];
  currentSlug?: string;
  onToggle?: () => void;
}

export function ResponsiveSidebar({ apps, currentSlug }: ResponsiveSidebarProps) {
  return (
    <>
      <aside className="hidden lg:flex w-[280px] shrink-0 flex-col gap-1 border-r p-4" aria-label="사이드바">
        {apps.map((a) => (
          <Link key={a.id} href={`/apps/${a.slug}`}
            className={`min-h-[48px] flex items-center gap-2 rounded-lg px-3 py-2 text-[clamp(14px,1.5vw,18px)] ${currentSlug === a.slug ? "bg-orange-100 font-bold" : "hover:bg-gray-100"}`}>
            <span aria-hidden>▦</span><span>{a.name}</span>
          </Link>
        ))}
      </aside>
      <aside className="hidden md:flex lg:hidden w-[80px] shrink-0 flex-col items-center gap-2 border-r p-2" aria-label="접이식 사이드바">
        {apps.map((a) => (
          <Link key={a.id} href={`/apps/${a.slug}`} aria-label={a.name}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-[clamp(16px,2vw,24px)]">▦</Link>
        ))}
      </aside>
    </>
  );
}
