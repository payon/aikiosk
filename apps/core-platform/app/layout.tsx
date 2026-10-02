import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RustKorea Unified Platform",
  description: "단일 도메인 통합 앱 허브",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
