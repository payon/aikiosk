"use client";
import { useState } from "react";

function answer(q: string): string {
  if (/요금|가격|비용/.test(q)) return "요금제는 Starter(무료) / Pro(월 19,000원) / Enterprise(별도 협의) 3종입니다.";
  if (/앱|등록|추가/.test(q)) return "관리자 앱에서 이름·슬러그·URL·카테고리를 입력하면 런처에 즉시 반영됩니다.";
  if (/키오스크/.test(q)) return "21~55인치 세로형 키오스크를 지원합니다. 유휴 시 자동 로그아웃됩니다.";
  if (/안녕|hello/i.test(q)) return "안녕하세요! 통합 플랫폼 도우미입니다.";
  return `"${q}"에 대한 답변을 준비 중입니다. (데모 응답)`;
}

export default function Page() {
  const [log, setLog] = useState<{ who: "me" | "ai"; text: string }[]>([{ who: "ai", text: "안녕하세요! 무엇을 도와드릴까요?" }]);
  const [q, setQ] = useState("");
  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    setQ("");
    setLog((l) => [...l, { who: "me", text }]);
    setTimeout(() => setLog((l) => [...l, { who: "ai", text: answer(text) }]), 500);
  }
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 73px)", maxWidth: 800, margin: "0 auto" }}>
      <div aria-live="polite" aria-label="대화" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {log.map((m, i) => (
          <div key={i} style={{ maxWidth: "85%", padding: 12, borderRadius: 14, fontSize: 14, lineHeight: 1.5, alignSelf: m.who === "me" ? "flex-end" : "flex-start", background: m.who === "me" ? "#1D4ED8" : "#fff", color: m.who === "me" ? "#fff" : "#172554", boxShadow: m.who === "ai" ? "0 1px 4px rgba(0,0,0,.12)" : undefined }}>
            {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: 8, padding: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="질문을 입력하세요" aria-label="질문 입력" autoComplete="off"
          style={{ flex: 1, minHeight: 48, border: "1px solid #bfdbfe", borderRadius: 12, padding: "0 12px", fontSize: 14 }} />
        <button style={{ minHeight: 48, minWidth: 48, padding: "0 20px", border: 0, borderRadius: 12, background: "#1D4ED8", color: "#fff", fontSize: 14 }}>전송</button>
      </form>
    </main>
  );
}
