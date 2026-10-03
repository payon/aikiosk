"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getDeviceId(): string {
  let id = "";
  try {
    id = localStorage.getItem("rk_device_id") || "";
  } catch { /* ignore */ }
  if (!id) {
    id = "rk-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try {
      localStorage.setItem("rk_device_id", id);
    } catch { /* ignore */ }
  }
  return id;
}

// 키오스크 전용: 미승인 → 인증 코드 화면, 승인+지정 → 지정된 활성 화면으로 이동
export default function KioskPage() {
  const router = useRouter();
  const [uuid, setUuid] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("pending");
  const [appName, setAppName] = useState("");

  useEffect(() => {
    const id = getDeviceId();
    setUuid(id);
    const screen = `${window.innerWidth}x${window.innerHeight}`;
    let stop = false;
    const sync = async () => {
      try {
        const reg = await fetch("/api/device/register", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ uuid: id, screen })
        }).then((r) => r.json());
        if (!reg.success || stop) return;
        setCode(reg.data.code);
        const st = await fetch(`/api/device/status?uuid=${encodeURIComponent(id)}`).then((r) => r.json());
        if (!st.success || stop) return;
        setStatus(st.data.status);
        await fetch("/api/device/heartbeat", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ uuid: id, screen: `${window.innerWidth}x${window.innerHeight}` })
        }).catch(() => {});
        if (st.data.status === "approved") {
          const target = (st.data.assignedSlug || "").trim() || "all";
          if (target === "all") {
            router.replace("/");
            return;
          }
          if (target.startsWith("t:")) {
            router.replace(`/t/${target.slice(2)}`);
            return;
          }
          if (target.startsWith("cat:")) {
            router.replace(`/?cat=${encodeURIComponent(target.slice(4))}`);
            return;
          }
          const apps = await fetch("/api/apps").then((r) => r.json()).catch(() => null);
          const app = apps?.success ? apps.data.find((a: { slug: string }) => a.slug === target) : null;
          if (!app) {
            setAppName("지정된 앱을 찾을 수 없습니다. 관리자에게 문의하세요.");
            return;
          }
          setAppName(app.name);
          if (app.openMode === "direct") window.location.href = app.targetUrl;
          else router.replace(`/apps/${target}`);
          return;
        }
      } catch { /* 다음 폴링 */ }
    };
    sync();
    const t = setInterval(sync, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-900 text-white">
      <p className="text-[clamp(14px,2vw,16px)] text-gray-300">키오스크 인증</p>
      <p className="text-[clamp(48px,10vw,96px)] font-bold tracking-widest" aria-label="인증 코드">{code || "······"}</p>
      <p className="text-[clamp(12px,1.5vw,14px)] text-gray-400 font-mono break-all">{uuid}</p>
      <p role="status" className="text-[clamp(16px,2vw,24px)]">
        {status === "approved" ? (appName ? `${appName} 실행 중…` : "승인됨 — 화면 배정 대기") : status === "rejected" ? "거부됨 — 관리자에게 문의" : "어드민 장비 관리에서 승인해 주세요"}
      </p>
    </main>
  );
}
