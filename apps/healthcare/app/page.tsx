const STEPS = [8230, 10240, 6540, 11890, 9320, 12040, 7650];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const ROWS = [["09-28", "혈압", "120/80 정상"], ["09-20", "혈당", "98mg/dL 정상"], ["09-12", "콜레스테롤", "185mg/dL 주의"]];
const MAX = Math.max(...STEPS);

export default function Page() {
  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto", display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {[["오늘 걸음 수", STEPS.reduce((a, b) => a + b, 0).toLocaleString()], ["평균 심박", "72bpm"], ["수면 시간", "7h 12m"], ["복약 순응도", "96%"]].map(([k, v]) => (
          <div key={k as string} style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
            <b style={{ display: "block", fontSize: 28 }}>{v}</b>
            <span style={{ fontSize: 12, color: "#4d7c5f" }}>{k}</span>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>주간 활동량</h2>
        {STEPS.map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0", fontSize: 12 }}>
            <span style={{ width: 24 }}>{DAYS[i]}</span>
            <i style={{ display: "block", height: 24, borderRadius: 6, background: "#16a34a", width: `${Math.round((v / MAX) * 100)}%` }} />
            <span>{v.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>최근 검진</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={{ textAlign: "left", padding: "12px 8px" }}>일자</th><th style={{ textAlign: "left", padding: "12px 8px" }}>항목</th><th style={{ textAlign: "left", padding: "12px 8px" }}>결과</th></tr></thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0] + r[1]}>{r.map((c) => <td key={c} style={{ padding: "12px 8px", borderBottom: "1px solid #dcfce7" }}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
