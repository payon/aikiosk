"use client";
import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  // 유효 세션이면 대시보드로 (로그인 화면 갇힘 방지). 단, 일반 계정은 머문다.
  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return;
      const j = await r.json().catch(() => null);
      if (j?.success && j.data?.role === "ADMIN") router.replace("/");
    }).catch(() => {});
  }, [router]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.success) router.replace("/");
    else setErr(j.error?.message ?? "로그인 실패");
  }
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-3 border rounded-2xl p-6 bg-white">
        <h1 className="text-[clamp(24px,3vw,36px)] font-bold">관리자 로그인</h1>
        <input className="min-h-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)]" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="min-h-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)]" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p role="alert" className="text-red-600 text-[clamp(12px,1.5vw,18px)]">{err}</p>}
        <button className="min-h-[48px] rounded-lg bg-gray-900 text-white text-[clamp(16px,2vw,24px)]">로그인</button>
      </form>
    </main>
  );
}
