"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import type { AppRegistry } from "@/types/app";

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

export default function DevicePage() {
  const [apps, setApps] = useState<AppRegistry[]>([]);
  const [uuid, setUuid] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("pending");
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/apps").then(async (r) => {
      const j = await r.json();
      if (j.success) setApps(j.data);
    }).catch(() => {});
    const id = getDeviceId();
    setUuid(id);
    fetch("/api/device/register", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ uuid: id, name: "키오스크" })
    }).then(async (r) => {
      const j = await r.json();
      if (j.success) { setCode(j.data.code); setStatus(j.data.status); }
    }).catch(() => {});
    const t = setInterval(async () => {
      try {
        const s = await fetch(`/api/device/status?uuid=${encodeURIComponent(id)}`).then((r) => r.json());
        if (s.success) setStatus(s.data.status);
        await fetch("/api/device/heartbeat", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ uuid: id, screen: `${window.innerWidth}x${window.innerHeight}` })
        }).catch(() => {});
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const badge = status === "approved" ? "승인됨" : status === "rejected" ? "거부됨" : "승인 대기";

  return (
    <Shell apps={apps}>
      <h1 className="text-[clamp(24px,3vw,36px)] font-bold mb-4">장비 등록</h1>
      <div className="max-w-lg bg-white border rounded-2xl p-6 grid gap-3">
        <p className="text-[clamp(14px,2vw,16px)]">이 화면의 인증 코드를 어드민 장비 관리에 입력하면 승인됩니다.</p>
        <div>
          <span className="text-[clamp(12px,1.5vw,14px)] text-gray-500">장비 UUID</span>
          <p className="text-[clamp(12px,1.5vw,14px)] break-all font-mono">{uuid || "-"}</p>
        </div>
        <div>
          <span className="text-[clamp(12px,1.5vw,14px)] text-gray-500">인증 코드</span>
          <p className="text-[clamp(40px,8vw,72px)] font-bold tracking-widest">{code || "······"}</p>
        </div>
        <p role="status" className={`min-h-[48px] flex items-center rounded-lg px-3 text-[clamp(16px,2vw,24px)] ${status === "approved" ? "bg-green-100 font-bold" : "bg-orange-50"}`}>
          {badge}
        </p>
        <div className="flex gap-2">
          <input className="min-h-[48px] flex-1 border rounded-lg px-3 text-[clamp(14px,2vw,16px)]" placeholder="장비 이름 (예: 1층 키오스크)" value={name}
            onChange={(e) => setName(e.target.value)} aria-label="장비 이름" />
          <button className="min-h-[48px] rounded-lg bg-orange-700 text-white px-4 text-[clamp(16px,2vw,24px)]"
            onClick={async () => {
              const r = await fetch("/api/device/register", {
                method: "POST", headers: { "content-type": "application/json" },
                body: JSON.stringify({ uuid, name: name || "키오스크" })
              });
              const j = await r.json();
              if (j.success) { setCode(j.data.code); setStatus(j.data.status); }
            }}>이름 저장</button>
        </div>
      </div>
    </Shell>
  );
}
