"use client";
import { useEffect, useState } from "react";

// PWA 설치 버튼 (브라우저가 허용할 때만 표시) + 전체화면 토글 (키오스크용)
export function PwaActions() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferred, setDeferred] = useState<{ prompt: () => void } | null>(null);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as unknown as { prompt: () => void });
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    setDeferred(null);
    setCanInstall(false);
  }

  function toggleFull() {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed right-3 bottom-3 z-30 flex flex-col gap-2">
      {canInstall && (
        <button onClick={install} className="min-h-[48px] rounded-full bg-gray-900 text-white px-4 text-[clamp(14px,2vw,16px)] shadow-lg" aria-label="앱 설치">
          ⬇ 설치
        </button>
      )}
      <button onClick={toggleFull} className="min-h-[48px] min-w-[48px] rounded-full bg-white border px-3 shadow-lg text-[clamp(16px,2vw,20px)]" aria-label={isFull ? "전체화면 해제" : "전체화면"}>
        {isFull ? "⤓" : "⛶"}
      </button>
    </div>
  );
}
