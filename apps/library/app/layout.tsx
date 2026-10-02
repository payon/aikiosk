export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#FFF7ED", color: "#1c1917", touchAction: "manipulation" }}>
        <header style={{ position: "sticky", top: 0, background: "#7C2D12", color: "#fff", padding: "12px 16px", display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/" style={{ color: "#fff", minHeight: 48, minWidth: 48, display: "inline-flex", alignItems: "center", textDecoration: "none", fontSize: 14 }}>← 런처</a>
          <b style={{ fontSize: 20 }}>러스트 라이브러리</b>
        </header>
        {children}
      </body>
    </html>
  );
}
