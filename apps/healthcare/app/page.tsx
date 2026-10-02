import Link from "next/link";
import { EQUIPMENTS, NOTICES } from "@/data";

export default function Page() {
  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto", display: "grid", gap: 12 }}>
      <section style={{ background: "#0d9488", color: "#fff", borderRadius: 16, padding: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Biogram MINI 이용 교육</h1>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>장비를 고르면 단계별 이용법·주의사항·자가점검을 안내합니다.</p>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {EQUIPMENTS.map((e) => (
          <Link key={e.id} href={`/equipment/${e.id}`}
            style={{ aspectRatio: "4/5", background: "#fff", borderRadius: 16, padding: 16, textDecoration: "none", color: "inherit", boxShadow: "0 1px 4px rgba(0,0,0,.1)", display: "flex", flexDirection: "column", gap: 6, minHeight: 48 }}>
            <b style={{ fontSize: 16 }}>{e.name}</b>
            <span style={{ fontSize: 12, color: "#5f9ea0" }}>{e.desc}</span>
            <span style={{ fontSize: 12, color: "#0d9488", marginTop: "auto" }}>{e.time} · {e.level}</span>
          </Link>
        ))}
      </section>
      <section style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>공지사항</h2>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {NOTICES.map((n) => (
            <li key={n.date + n.text} style={{ fontSize: 14, padding: "12px 4px", borderBottom: "1px solid #ccfbf1" }}>
              <b>{n.date}</b> — {n.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
