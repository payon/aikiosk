"use client";
import { useState } from "react";
import { EQUIPMENTS } from "@/data";
import { notFound } from "next/navigation";
import Link from "next/link";

export default function Detail({ params }: { params: { id: string } }) {
  const eq = EQUIPMENTS.find((e) => e.id === params.id);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  if (!eq) notFound();
  const toggle = (c: string) =>
    setDone((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]));
  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto", display: "grid", gap: 12 }}>
      <div>
        <Link href="/" style={{ fontSize: 14, color: "#0d9488" }}>← 장비 목록</Link>
        <h1 style={{ fontSize: 24, margin: "8px 0 0" }}>{eq.name}</h1>
        <p style={{ fontSize: 14, color: "#5f9ea0" }}>{eq.desc} · {eq.time} · {eq.level}</p>
      </div>
      <section style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>이용 순서 ({step + 1}/{eq.steps.length})</h2>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {eq.steps.map((_, i) => (
            <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= step ? "#0d9488" : "#ccfbf1" }} />
          ))}
        </div>
        <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>{eq.steps[step].title}</h3>
        <p style={{ fontSize: 14 }}>{eq.steps[step].body}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button disabled={step === 0} onClick={() => setStep(step - 1)}
            style={{ flex: 1, minHeight: 48, borderRadius: 10, border: "1px solid #99f6e4", background: "#fff", fontSize: 14 }}>이전</button>
          <button disabled={step === eq.steps.length - 1} onClick={() => setStep(step + 1)}
            style={{ flex: 1, minHeight: 48, borderRadius: 10, border: 0, background: "#0d9488", color: "#fff", fontSize: 14 }}>다음</button>
        </div>
      </section>
      <section style={{ background: "#fef2f2", borderRadius: 16, padding: 16 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "#b91c1c" }}>주의사항</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: "grid", gap: 6 }}>
          {eq.cautions.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </section>
      <section style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>자가점검 ({done.length}/{eq.checklist.length})</h2>
        {eq.checklist.map((c) => (
          <label key={c} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, fontSize: 14 }}>
            <input type="checkbox" checked={done.includes(c)} onChange={() => toggle(c)} style={{ width: 24, height: 24 }} />
            {c}
          </label>
        ))}
      </section>
    </main>
  );
}
