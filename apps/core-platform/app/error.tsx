"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">
      <h1 className="text-[clamp(24px,3vw,36px)] font-bold">오류가 발생했습니다</h1>
      <button onClick={reset} className="min-h-[48px] rounded-lg bg-orange-700 text-white px-4 text-[clamp(16px,2vw,24px)]">다시 시도</button>
    </main>
  );
}
