"use client";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import type { ShellLayoutProps } from "@/types/app";
import { useRouter } from "next/navigation";

export function Shell({ brand, idleMin, children }: ShellLayoutProps) {
  useIdleTimer((idleMin && idleMin >= 1 && idleMin <= 30 ? idleMin : 3) * 60 * 1000);
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur px-4 min-h-[48px] flex items-center justify-between">
        <button onClick={() => router.push("/")} className="font-bold text-[clamp(16px,2vw,24px)] min-h-[48px]" aria-label="홈">
          {brand || "RustKorea Hub"}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[clamp(12px,1.5vw,18px)] text-gray-500">SSO 연결됨</span>
          <button onClick={logout} className="min-h-[48px] min-w-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)]" aria-label="로그아웃">
            로그아웃
          </button>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
