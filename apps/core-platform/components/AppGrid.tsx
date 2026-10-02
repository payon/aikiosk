"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import type { AppRegistry } from "@/types/app";

export interface AppGridProps {
  apps: AppRegistry[];
  onAppClick: (slug: string) => void;
}

function AppCard({ app, onClick }: { app: AppRegistry; onClick: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  // 앱별 배경: 이미지(cover, 해상도 자동대응) 또는 단색. 가독성 오버레이 포함.
  const cardStyle: React.CSSProperties =
    app.bgType === "image" && app.bgImage
      ? { backgroundImage: `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.82)), url(${app.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { backgroundColor: app.bgColor || "#FFFFFF" };
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      style={cardStyle}
      className="aspect-[4/5] min-h-[48px] min-w-[48px] rounded-2xl bg-white p-4 shadow hover:shadow-lg flex flex-col items-center justify-center gap-2"
      aria-label={app.name}
    >
      {imgOk ? (
        <img
          src={app.iconUrl}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="w-[clamp(48px,6vw,80px)] h-[clamp(48px,6vw,80px)] object-contain"
        />
      ) : (
        <span className="text-[clamp(32px,4vw,64px)] min-[1900px]:text-[clamp(48px,3vw,80px)]" aria-hidden>
          {app.name.slice(0, 1)}
        </span>
      )}
      <span className="font-semibold text-center text-[clamp(14px,2vw,16px)] md:text-[clamp(16px,2.5vw,18px)] lg:text-[clamp(16px,1.5vw,18px)] min-[1900px]:text-[clamp(24px,2vw,32px)] min-[2100px]:text-[clamp(32px,1.5vw,48px)]">
        {app.name}
      </span>
      {app.openMode === "direct" && (
        <span className="rounded-full border px-2 py-0.5 text-[clamp(10px,1.2vw,12px)] text-gray-500">외부 앱 · 뒤로가기로 복귀</span>
      )}
      {app.description && (
        <span className="text-gray-500 text-center line-clamp-2 text-[clamp(12px,1.5vw,18px)] min-[1900px]:text-[clamp(18px,1.2vw,24px)]">
          {app.description}
        </span>
      )}
    </motion.button>
  );
}

// uiux.md 3.2 반응형 그리드 (세로형 우선)
export function AppGrid({ apps, onAppClick }: AppGridProps) {
  return (
    <div
      className="mx-auto w-full max-w-[1600px] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[2100px]:grid-cols-5 gap-4"
      role="grid"
      aria-label="앱 런처"
    >
      {apps.map((app) => (
        <AppCard key={app.id} app={app} onClick={() => onAppClick(app.slug)} />
      ))}
    </div>
  );
}
