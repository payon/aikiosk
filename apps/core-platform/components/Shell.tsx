"use client";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import type { ShellLayoutProps } from "@/types/app";
import { useRouter } from "next/navigation";

export function Shell({ brand, idleMin, bodyStyle, children }: ShellLayoutProps) {
  useIdleTimer((idleMin && idleMin >= 1 && idleMin <= 30 ? idleMin : 3) * 60 * 1000);
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col" style={bodyStyle}>
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur px-4 min-h-[48px] flex items-center">
        <button onClick={() => router.push("/")} className="font-bold text-[clamp(16px,2vw,24px)] min-h-[48px]" aria-label="홈">
          {brand || "RustKorea Hub"}
        </button>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
