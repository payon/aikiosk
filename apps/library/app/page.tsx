"use client";
import { useState } from "react";

const BOOKS = [
  { t: "러스트 프로그래밍 입문", a: "김러스트", d: "소유권·빌림부터 비동기까지, 처음 배우는 시스템 프로그래밍." },
  { t: "Tokio 실전 비동기", a: "박토키오", d: "런타임·태스크·채널 패턴으로 만드는 고성능 서버." },
  { t: "Axum 웹 완벽 가이드", a: "이억섬", d: "미들웨어·추출기·상태공유로 만드는 API 서버." },
  { t: "안전한 동시성", a: "최페럴", d: "Send/Sync·Arc·Mutex를 이해하는 동시성 교과서." },
  { t: "WASM과 러스트", a: "정와즘", d: "브라우저와 엣지에서 돌리는 경량 모듈." },
  { t: "임베디드 러스트", a: "한임베", d: "no_std 환경의 드라이버와 펌웨어." }
];

export default function Page() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<(typeof BOOKS)[number] | null>(null);
  const list = BOOKS.filter((b) => !q.trim() || (b.t + b.a).includes(q.trim()));
  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <input placeholder="도서 검색 (예: 러스트)" aria-label="도서 검색" value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", minHeight: 48, border: "1px solid #d6d3d1", borderRadius: 12, padding: "0 12px", fontSize: 14 }} />
      <div role="grid" aria-label="도서 목록" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginTop: 12 }}>
        {list.map((b) => (
          <div key={b.t} style={{ aspectRatio: "4/5", background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,.12)", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <b style={{ fontSize: 14 }}>{b.t}</b>
            <span style={{ fontSize: 12, color: "#78716c" }}>{b.a}</span>
            <button onClick={() => setSel(b)} style={{ marginTop: "auto", minHeight: 48, border: 0, borderRadius: 10, background: "#C2410C", color: "#fff", fontSize: 14 }}>상세보기</button>
          </div>
        ))}
      </div>
      {list.length === 0 && <p>검색 결과가 없습니다.</p>}
      {sel && (
        <div role="dialog" aria-label="도서 상세" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, maxWidth: 420, width: "100%" }}>
            <h2 style={{ margin: "0 0 8px" }}>{sel.t}</h2>
            <p>{sel.a} — {sel.d}</p>
            <button onClick={() => setSel(null)} style={{ minHeight: 48, width: "100%", marginTop: 12, borderRadius: 10, border: "1px solid #d6d3d1", fontSize: 14 }}>닫기</button>
          </div>
        </div>
      )}
    </main>
  );
}
