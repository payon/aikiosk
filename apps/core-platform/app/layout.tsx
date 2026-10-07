import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "RustKorea Unified Platform",
  description: "단일 도메인 통합 앱 허브",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RK Hub" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" }
};

export async function generateViewport(): Promise<Viewport> {
  let themeColor = "#0F766E";
  try {
    const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";
    const r = await fetch(`${BACKEND}/api/platform`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (j.success && j.data?.primaryColor) themeColor = j.data.primaryColor;
    }
  } catch { /* 기본값 */ }
  return {
    themeColor,
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
    userScalable: false
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
