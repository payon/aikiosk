"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// 키오스크 대기화면 유지: 세션 있으면 파기 후 로그인으로, 없으면 메인(/)에 그대로 머문다.
export function useIdleTimer(timeoutMs = 3 * 60 * 1000) {
  const router = useRouter();
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onIdle = async () => {
      try {
        const me = await fetch("/api/auth/me").then((r) => r.ok).catch(() => false);
        if (me) {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
          router.replace("/login");
        } else {
          router.replace("/");
        }
      } catch {
        router.replace("/");
      }
    };
    const reset = () => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(onIdle, timeoutMs);
    };
    const evts = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    evts.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      evts.forEach((e) => window.removeEventListener(e, reset));
      if (t.current) clearTimeout(t.current);
    };
  }, [router, timeoutMs]);
}
