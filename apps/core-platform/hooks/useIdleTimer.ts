"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useIdleTimer(timeoutMs = 3 * 60 * 1000) {
  const router = useRouter();
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const reset = () => {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.replace("/login");
      }, timeoutMs);
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
