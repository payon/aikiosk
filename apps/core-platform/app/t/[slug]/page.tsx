"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Comp { id: string; type: string; props: Record<string, unknown>; }
interface Page { id: string; title: string; components: Comp[]; }
interface Tpl { slug: string; name: string; pages: Page[]; completePageId?: string | null; version: number; }

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

function CompView({ c, go }: { c: Comp; go: (target: string) => void }) {
  const p = c.props || {};
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
    return (
      <button onClick={() => { if (str(p.tts)) speak(str(p.tts)); go(str(p.target, "")); }}
        style={{
          minHeight: Math.max(48, num(p.height, 64)), width: "100%",
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
      <video src={str(p.src)} controls playsInline preload="metadata"
        style={{ width: "100%", borderRadius: 12, margin: "8px 0", background: "#000", minHeight: 200 }} />
    );
  }
  if (c.type === "nav") {
    return (
      <button onClick={() => go(str(p.target, "/"))}
        style={{ minHeight: 48, width: "100%", borderRadius: 10, border: "1px solid #ccc", background: "#fff", fontSize: 16, margin: "6px 0" }}>
        {str(p.label, "이동")}
      </button>
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

  useEffect(() => {
    fetch(`/api/templates/${params.slug}`).then(async (r) => {
      const j = await r.json();
      if (j.success) {
        setTpl(j.data);
        try {
          const uuid = localStorage.getItem("rk_device_id") || "browser";
          fetch("/api/device/events", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ uuid, events: [{ appSlug: `t-${params.slug}`, type: "APP_START" }] })
          }).catch(() => {});
        } catch { /* ignore */ }
      } else setErr("게시된 템플릿이 없습니다");
    }).catch(() => setErr("불러오기 실패"));
  }, [params.slug]);

  const go = (target: string) => {
    if (!target) return;
    if (target === "/") { router.push("/"); return; }
    if (target.startsWith("/")) { router.push(target); return; }
    if (/^https?:\/\//.test(target)) { window.location.href = target; return; }
    // 페이지 ID 이동
    if (tpl) {
      const i = tpl.pages.findIndex((p) => p.id === target);
      if (i >= 0) {
        setPageIdx(i);
        window.scrollTo(0, 0);
        if (tpl.completePageId && tpl.completePageId === target && !done) {
          setDone(true);
          try {
            const uuid = localStorage.getItem("rk_device_id") || "browser";
            fetch("/api/device/events", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ uuid, events: [{ appSlug: `t-${tpl.slug}`, type: "APP_COMPLETE" }] })
            }).catch(() => {});
          } catch { /* ignore */ }
        }
      }
    }
  };

  if (err) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">
        <p>{err}</p>
        <button onClick={() => router.push("/")} className="min-h-[48px] rounded-lg bg-orange-700 text-white px-4">런처로</button>
      </main>
    );
  }
  if (!tpl) return <main className="min-h-screen flex items-center justify-center p-4">불러오는 중…</main>;
  const page = tpl.pages[pageIdx] || tpl.pages[0];
  if (!page) return <main className="min-h-screen flex items-center justify-center p-4">빈 템플릿입니다</main>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FFF7ED" }}>
      <header className="sticky top-0 z-10 bg-white/95 border-b px-4 min-h-[48px] flex items-center gap-2">
        <button onClick={() => router.push("/")} className="min-h-[48px] min-w-[48px]" aria-label="런처로">←</button>
        <b className="text-[clamp(16px,2vw,24px)]">{tpl.name} · {page.title}</b>
        <span className="ml-auto text-[clamp(12px,1.5vw,14px)] text-gray-400">v{tpl.version}</span>
      </header>
      <main className="flex-1 w-full max-w-[640px] mx-auto p-4 pb-10">
        {(page.components || []).map((c) => <CompView key={c.id} c={c} go={go} />)}
      </main>
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
