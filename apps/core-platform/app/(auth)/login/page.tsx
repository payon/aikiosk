"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (r.ok) router.replace("/");
    else setErr("로그인 실패. 이메일/비밀번호를 확인하세요.");
  }
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-3 border rounded-2xl p-6">
        <h1 className="text-[clamp(24px,3vw,36px)] font-bold">로그인</h1>
        <input className="min-h-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)]" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="min-h-[48px] border rounded-lg px-3 text-[clamp(14px,2vw,16px)]" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p role="alert" className="text-red-600 text-[clamp(12px,1.5vw,18px)]">{err}</p>}
        <button className="min-h-[48px] rounded-lg bg-orange-700 text-white text-[clamp(16px,2vw,24px)]">로그인</button>
      </form>
    </main>
  );
}
