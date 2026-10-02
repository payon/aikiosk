"use client";
import { useEffect, useState } from "react";

export type DeviceType = "mobile" | "tablet" | "desktop" | "kiosk";

export function useDeviceType(): DeviceType {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = () => {
      clearTimeout(t);
      t = setTimeout(() => setW(window.innerWidth), 150);
    };
    window.addEventListener("resize", on);
    return () => { clearTimeout(t); window.removeEventListener("resize", on); };
  }, []);
  if (w < 768) return "mobile";
  if (w < 1025) return "tablet";
  if (w < 1920) return "desktop";
  return "kiosk";
}
