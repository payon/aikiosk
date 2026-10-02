export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#F0FDF4", color: "#052e16", touchAction: "manipulation" }}>
        <header style={{ background: "#15803D", color: "#fff", padding: "12px 16px", display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/" style={{ color: "#fff", minHeight: 48, minWidth: 48, display: "inline-flex", alignItems: "center", textDecoration: "none", fontSize: 14 }}>← 런처</a>
          <b style={{ fontSize: 20 }}>헬스케어 대시보드</b>
        </header>
        {children}
      </body>
    </html>
  );
}
