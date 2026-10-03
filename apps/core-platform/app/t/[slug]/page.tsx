"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";

interface Comp { id: string; type: string; props: Record<string, unknown>; }
interface Page { id: string; title: string; bg?: string; bgImage?: string; components: Comp[]; }
interface Tpl { slug: string; name: string; pages: Page[]; completePageId?: string | null; version: number; status?: string; }
interface Action { type: string; [k: string]: unknown; }

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}
function num(v: unknown, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

function sendEvent(slug: string, type: string, payload?: Record<string, unknown>) {
  try {
    const uuid = localStorage.getItem("rk_device_id") || "browser";
    const body = JSON.stringify({ uuid, events: [{ appSlug: slug, type, ...(payload ? { payload } : {}) }] });
    const send = () =>
      fetch("/api/device/events", {
        method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true
      }).then((r) => {
        if (!r.ok) throw new Error("send fail");
        flushQueue();
      }).catch(() => {
        // 오프라인 큐 (최대 200건, 복구 시 flush)
        try {
          const q = JSON.parse(localStorage.getItem("rk_queue") || "[]");
          q.push({ uuid, body: JSON.parse(body), at: Date.now() });
          localStorage.setItem("rk_queue", JSON.stringify(q.slice(-200)));
        } catch { /* ignore */ }
      });
    if (navigator.onLine === false) {
      try {
        const q = JSON.parse(localStorage.getItem("rk_queue") || "[]");
        q.push({ uuid, body: JSON.parse(body), at: Date.now() });
        localStorage.setItem("rk_queue", JSON.stringify(q.slice(-200)));
      } catch { /* ignore */ }
      return;
    }
    send();
  } catch { /* ignore */ }
}

function flushQueue() {
  try {
    const q = JSON.parse(localStorage.getItem("rk_queue") || "[]") as { body: unknown }[];
    if (!q.length) return;
    localStorage.setItem("rk_queue", "[]");
    for (const item of q.slice(0, 50)) {
      fetch("/api/device/events", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(item.body), keepalive: true
      }).catch(() => {});
    }
  } catch { /* ignore */ }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", flushQueue);
}

function Placed({ c, children }: { c: Comp; children: React.ReactNode }) {
  const p = c.props || {};
  const mt = Math.min(200, Math.max(0, num(p.mt, 0)));
  const align = str(p.align, "");
  return (
    <div style={{
      marginTop: mt || undefined,
      display: "flex", flexDirection: "column",
      alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "stretch"
    }}>{children}</div>
  );
}

function HtmlBlock({ html }: { html: string }) {
  // 살균은 html 변경 시 1회만 (대용량 HTML 반복 살균 방지)
  const clean = useMemo(() => {
    try {
      return DOMPurify.sanitize(html, { FORBID_TAGS: ["script", "iframe", "object", "embed", "form"] });
    } catch {
      return "";
    }
  }, [html]);
  if (clean.length > 500000) {
    return <p style={{ fontSize: 14, color: "#b91c1c" }}>HTML이 너무 큽니다 (50만자 이하로 줄여주세요)</p>;
  }
  return (
    <div style={{ margin: "8px 0", overflow: "hidden", borderRadius: 12 }}>
      <div dangerouslySetInnerHTML={{ __html: clean }} />
      <p style={{ fontSize: 12, color: "#888" }}>외부 HTML (스크립트 실행 차단됨)</p>
    </div>
  );
}

function CompView({ c, go, act, cartAdd }: {
  c: Comp; go: (target: string) => void;
  act: (actions: Action[]) => void; cartAdd: (name: string, price: number) => void;
}) {
  const p = c.props || {};
  const inner = CompInner({ c, go, act, cartAdd });
  return <Placed c={c}>{inner}</Placed>;
}

function CompInner({ c, go, act, cartAdd }: {
  c: Comp; go: (target: string) => void;
  act: (actions: Action[]) => void; cartAdd: (name: string, price: number) => void;
}) {
  const p = c.props || {};
  const [picked, setPicked] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const actions = Array.isArray(p.actions) ? (p.actions as Action[]) : [];

  if (c.type === "text") {
    return (
      <div style={{ background: str(p.bg, "transparent"), color: str(p.color, "#111"), textAlign: (str(p.align, "left") as "left"), padding: "12px 4px", fontSize: num(p.size, 20) }}>
        {str(p.content, "텍스트")}
        {str(p.tts) ? (
          <button onClick={() => speak(str(p.tts))} aria-label="음성 듣기"
            style={{ marginLeft: 8, minHeight: 48, minWidth: 48, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}>🔊</button>
        ) : null}
      </div>
    );
  }
  if (c.type === "button") {
    const auto = str(p.w, "full") === "auto";
    return (
      <button onClick={() => {
        if (str(p.tts)) speak(str(p.tts));
        if (actions.length) act(actions);
        else go(str(p.target, ""));
      }}
        style={{
          minHeight: Math.max(48, num(p.height, 64)), width: auto ? "auto" : "100%",
          padding: auto ? "0 28px" : undefined,
          background: str(p.bg, "#C2410C"), color: str(p.color, "#fff"),
          fontSize: num(p.size, 22), borderRadius: 14, border: 0, margin: "6px 0"
        }}>
        {str(p.label, "버튼")}
      </button>
    );
  }
  if (c.type === "image") {
    return (
      <figure style={{ margin: "8px 0" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={str(p.src)} alt={str(p.alt, "이미지")} style={{ width: "100%", height: num(p.height, 0) || "auto", objectFit: "cover", borderRadius: 12 }} />
      </figure>
    );
  }
  if (c.type === "video") {
    return (
      <div style={{ margin: "8px 0" }}>
        <video src={str(p.src)} controls playsInline preload="metadata"
          style={{ width: "100%", borderRadius: 12, background: "#000", minHeight: 200 }} />
        {str(p.subtitle) ? <p style={{ fontSize: 14, color: "#555" }}>자막: {str(p.subtitle)}</p> : null}
      </div>
    );
  }
  if (c.type === "html") {
    return <HtmlBlock html={str(p.html)} />;
  }
  if (c.type === "nav") {
    const auto = str(p.w, "full") === "auto";
    return (
      <button onClick={() => go(str(p.target, "/"))}
        style={{ minHeight: 48, width: auto ? "auto" : "100%", padding: auto ? "0 20px" : undefined, borderRadius: 10, border: "1px solid #ccc", background: "#fff", fontSize: 16, margin: "6px 0" }}>
        {str(p.label, "이동")}
      </button>
    );
  }
  if (c.type === "appbar") {
    return (
      <div style={{ background: str(p.bg, "#0d9488"), color: str(p.color, "#fff"), borderRadius: 12, padding: "14px 16px", fontSize: num(p.size, 20), fontWeight: "bold" }}>
        {str(p.title, "앱")}
      </div>
    );
  }
  if (c.type === "progress") {
    const v = num(p.value, 30), max = num(p.max, 100);
    return (
      <div style={{ margin: "8px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666" }}>
          <span>{str(p.label, "진행률")}</span><span>{Math.round((v / max) * 100)}%</span>
        </div>
        <div style={{ height: 14, background: "#e5e7eb", borderRadius: 7, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, (v / max) * 100)}%`, height: "100%", background: str(p.bg, "#0d9488") }} />
        </div>
      </div>
    );
  }
  if (c.type === "ticker") {
    return (
      <div style={{ overflow: "hidden", background: str(p.bg, "#111"), color: str(p.color, "#fff"), borderRadius: 10, padding: "10px 0", fontSize: num(p.size, 15) }}>
        <div style={{ display: "inline-block", whiteSpace: "nowrap", animation: "rk-tick 18s linear infinite", paddingLeft: "100%" }}>
          {str(p.text, "공지사항")}
        </div>
        <style>{`@keyframes rk-tick { to { transform: translateX(-100%); } }`}</style>
      </div>
    );
  }
  if (c.type === "quiz") {
    const opts: string[] = Array.isArray(p.options) ? (p.options as string[]).slice(0, 4) : ["선택1", "선택2"];
    const ans = num(p.answer, 0);
    return (
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #e5e7eb" }}>
        <p style={{ fontSize: 17, fontWeight: "bold", margin: "0 0 8px" }}>❓ {str(p.question, "질문")}</p>
        {opts.map((o, i) => (
          <button key={i} onClick={() => { setPicked(i); act([{ type: "TOAST", text: i === ans ? "정답입니다!" : "다시 생각해 보세요" }]); }}
            style={{ display: "block", width: "100%", minHeight: 48, margin: "6px 0", borderRadius: 10, fontSize: 16,
              border: picked === null ? "1px solid #ccc" : i === ans ? "2px solid #15803D" : picked === i ? "2px solid #b91c1c" : "1px solid #ccc",
              background: "#fff" }}>
            {i + 1}. {o}
          </button>
        ))}
      </div>
    );
  }
  if (c.type === "survey") {
    const moods = [["😊", 5], ["😐", 3], ["😞", 1]] as const;
    return (
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #e5e7eb", textAlign: "center" }}>
        <p style={{ fontSize: 17, fontWeight: "bold" }}>{str(p.question, "오늘 교육이 도움이 되셨나요?")}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", fontSize: 40 }}>
          {moods.map(([m, s]) => (
            <button key={m} onClick={() => {
              setMood(m);
              try {
                const uuid = localStorage.getItem("rk_device_id") || "browser";
                fetch("/api/device/events", {
                  method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ uuid, events: [{ appSlug: str(p.appSlug, "survey"), type: "SURVEY", payload: { question: str(p.question, ""), mood: m, score: s } }] })
                }).catch(() => {});
              } catch { /* ignore */ }
              act([{ type: "TOAST", text: "응답 감사합니다!" }]);
            }}
              style={{ minHeight: 64, minWidth: 64, borderRadius: 14, border: mood === m ? "3px solid #0d9488" : "1px solid #ccc", background: "#fff" }}
              aria-label={`만족도 ${s}점`}>{m}</button>
          ))}
        </div>
      </div>
    );
  }
  if (c.type === "numpad") {
    return (
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #e5e7eb" }}>
        <p style={{ fontSize: 15, color: "#555" }}>{str(p.label, "숫자를 입력하세요")}</p>
        <p aria-live="polite" style={{ fontSize: 28, letterSpacing: 6, minHeight: 48 }}>{"●".repeat(pin.length) || "－"}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "지움", "0", "확인"].map((k) => (
            <button key={k} onClick={() => {
              if (k === "지움") setPin(pin.slice(0, -1));
              else if (k === "확인") { act([{ type: "TOAST", text: `입력됨: ${pin || "없음"}` }]); if (str(p.target)) go(str(p.target)); }
              else if (pin.length < 12) setPin(pin + k);
            }} style={{ minHeight: 56, borderRadius: 10, border: "1px solid #ccc", background: "#fff", fontSize: 20 }}>{k}</button>
          ))}
        </div>
      </div>
    );
  }
  if (c.type === "productgrid") {
    const dsId = str(p.datasetId);
    useEffect(() => {
      if (!dsId) return;
      fetch(`/api/datasets/${dsId}`).then((r) => r.json()).then((j) => {
        if (j.success && Array.isArray(j.data.rows)) setRows(j.data.rows);
      }).catch(() => {});
    }, [dsId]);
    const tf = str(p.titleField, "이름"), pf = str(p.priceField, "가격"), imf = str(p.imageField, "이미지");
    const cols = Math.min(4, Math.max(2, num(p.columns, 2)));
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10 }}>
          {rows.map((r, i) => (
            <button key={i} onClick={() => cartAdd(String(r[tf] ?? `상품${i + 1}`), Number(r[pf]) || 0)}
              style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, minHeight: 48, fontSize: 14 }}>
              {r[imf] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(r[imf])} alt="" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8 }} />
              ) : null}
              <b style={{ display: "block", marginTop: 4 }}>{String(r[tf] ?? `상품${i + 1}`)}</b>
              <span style={{ color: "#C2410C", fontWeight: "bold" }}>{Number(r[pf]) ? `${Number(r[pf]).toLocaleString()}원` : ""}</span>
            </button>
          ))}
        </div>
        {!rows.length && <p style={{ fontSize: 14, color: "#888" }}>데이터셋을 연결하세요 (에디터에서 지정)</p>}
      </div>
    );
  }
  return null;
}

export default function TemplateView({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState("");
  const [cart, setCart] = useState<{ name: string; price: number }[]>([]);

  useEffect(() => {
    fetch(`/api/templates/${params.slug}`).then(async (r) => {
      const j = await r.json();
      if (j.success) {
        setTpl(j.data);
        sendEvent(`t-${params.slug}`, "APP_START");
      } else setErr("게시된 템플릿이 없습니다");
    }).catch(() => setErr("불러오기 실패"));
  }, [params.slug]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const go = (target: string) => {
    if (!target) return;
    if (target === "/") { router.push("/"); return; }
    if (target.startsWith("/")) { router.push(target); return; }
    if (/^https?:\/\//.test(target)) { window.location.href = target; return; }
    if (tpl) {
      const i = tpl.pages.findIndex((p) => p.id === target);
      if (i >= 0) {
        setPageIdx(i);
        window.scrollTo(0, 0);
        if (tpl.completePageId && tpl.completePageId === target && !done) {
          setDone(true);
          sendEvent(`t-${tpl.slug}`, "APP_COMPLETE");
        }
      }
    }
  };

  // 액션 체인 실행 (순차)
  const act = async (actions: Action[]) => {
    for (const a of actions) {
      try {
        if (a.type === "TOAST") setToast(String(a.text || ""));
        else if (a.type === "POPUP") setModal(String(a.text || ""));
        else if (a.type === "SPEAK") speak(String(a.text || ""));
        else if (a.type === "NAVIGATE") go(String(a.target || ""));
        else if (a.type === "STATE_UPDATE") {
          const k = String(a.key || "");
          if (k) {
            try {
              const cur = JSON.parse(localStorage.getItem("rk_state") || "{}");
              cur[k] = a.value;
              localStorage.setItem("rk_state", JSON.stringify(cur));
            } catch { /* ignore */ }
          }
        } else if (a.type === "STATE_RESET") {
          try { localStorage.removeItem("rk_state"); } catch { /* ignore */ }
          setCart([]);
        } else if (a.type === "API_CALL") {
          await fetch(String(a.url || ""), {
            method: String(a.method || "POST"),
            headers: { "content-type": "application/json" },
            body: JSON.stringify(a.body || {})
          }).catch(() => null);
        }
      } catch { /* 다음 액션 계속 */ }
    }
  };

  const cartAdd = (name: string, price: number) => {
    setCart((c) => [...c, { name, price }]);
    setToast(`${name} 담기`);
  };

  if (err) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">
        <p>게시된 템플릿이 없습니다.</p>
        <p className="text-[clamp(12px,1.5vw,14px)] text-gray-500">초안 상태이거나 삭제된 경우입니다. 어드민 템플릿 탭에서 저장 → 게시를 눌러주세요.</p>
        <button onClick={() => router.push("/")} className="min-h-[48px] rounded-lg bg-orange-700 text-white px-4">런처로</button>
      </main>
    );
  }
  if (!tpl) return <main className="min-h-screen flex items-center justify-center p-4">불러오는 중…</main>;
  const page = tpl.pages[pageIdx] || tpl.pages[0];
  if (!page) return <main className="min-h-screen flex items-center justify-center p-4">빈 템플릿입니다</main>;
  const pageBg = page.bgImage
    ? { backgroundImage: `url(${page.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: page.bg || "#FFF7ED" };
  const total = cart.reduce((s, i) => s + i.price, 0);

  return (
    <div className="min-h-screen flex flex-col" style={pageBg as React.CSSProperties}>
      <header className="sticky top-0 z-10 bg-white/95 border-b px-4 min-h-[48px] flex items-center gap-2">
        <button onClick={() => router.push("/")} className="min-h-[48px] min-w-[48px]" aria-label="런처로">←</button>
        <b className="text-[clamp(16px,2vw,24px)]">{tpl.name} · {page.title}</b>
        <span className="ml-auto text-[clamp(12px,1.5vw,14px)] text-gray-400">v{tpl.version}</span>
        {tpl.status === "review" && <span className="text-[clamp(12px,1.5vw,14px)] font-bold text-orange-700 border border-orange-300 rounded-full px-2">검수중(미게시)</span>}
        {cart.length > 0 && <span className="text-[clamp(12px,1.5vw,14px)] font-bold">🛒{cart.length} {total.toLocaleString()}원</span>}
      </header>
      <main className="flex-1 w-full max-w-[640px] mx-auto p-4 pb-10">
        {(page.components || []).map((c) => <CompView key={c.id} c={c} go={go} act={act} cartAdd={cartAdd} />)}
      </main>
      {toast && (
        <div role="status" className="fixed left-4 right-4 bottom-24 z-40 mx-auto max-w-[480px] rounded-xl bg-gray-900 text-white px-4 min-h-[56px] flex items-center justify-center">
          {toast}
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" role="dialog" aria-label="알림">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal("")} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="text-[clamp(16px,2vw,20px)] mb-4">{modal}</p>
            <button onClick={() => setModal("")} className="min-h-[48px] w-full rounded-lg bg-orange-700 text-white">확인</button>
          </div>
        </div>
      )}
      <nav className="sticky bottom-0 bg-white border-t px-4 py-2 flex gap-2 overflow-x-auto">
        {tpl.pages.map((p, i) => (
          <button key={p.id} onClick={() => { setPageIdx(i); window.scrollTo(0, 0); }}
            aria-current={i === pageIdx}
            className={`min-h-[48px] whitespace-nowrap rounded-full border px-4 text-[clamp(14px,2vw,16px)] ${i === pageIdx ? "bg-orange-700 text-white border-orange-700 font-bold" : ""}`}>
            {p.title}
          </button>
        ))}
      </nav>
    </div>
  );
}
