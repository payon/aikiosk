"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import type { AppRegistry } from "@/types/app";

export interface GridConfig {
  density: "comfortable" | "compact";
  cols: { mobile: number; tablet: number; desktop: number; kiosk: number };
  showName: boolean;
}

export interface AppGridProps {
  apps: AppRegistry[];
  onAppClick: (slug: string) => void;
  config?: Partial<GridConfig>;
}

// Tailwind 정적 클래스 조회 (동적 클래스명은 빌드 시 생성 안되므로 전부 리터럴)
const COLS: Record<number, string> = {
  1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4",
  5: "grid-cols-5", 6: "grid-cols-6", 7: "grid-cols-7", 8: "grid-cols-8",
  9: "grid-cols-9", 10: "grid-cols-10", 11: "grid-cols-11", 12: "grid-cols-12"
};
const COLS_MD: Record<number, string> = {
  1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4",
  5: "md:grid-cols-5", 6: "md:grid-cols-6", 7: "md:grid-cols-7", 8: "md:grid-cols-8",
  9: "md:grid-cols-9", 10: "md:grid-cols-10", 11: "md:grid-cols-11", 12: "md:grid-cols-12"
};
const COLS_LG: Record<number, string> = {
  1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4",
  5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 7: "lg:grid-cols-7", 8: "lg:grid-cols-8",
  9: "lg:grid-cols-9", 10: "lg:grid-cols-10", 11: "lg:grid-cols-11", 12: "lg:grid-cols-12"
};
const COLS_KIOSK: Record<number, string> = {
  1: "min-[2100px]:grid-cols-1", 2: "min-[2100px]:grid-cols-2", 3: "min-[2100px]:grid-cols-3",
  4: "min-[2100px]:grid-cols-4", 5: "min-[2100px]:grid-cols-5", 6: "min-[2100px]:grid-cols-6",
  7: "min-[2100px]:grid-cols-7", 8: "min-[2100px]:grid-cols-8", 9: "min-[2100px]:grid-cols-9",
  10: "min-[2100px]:grid-cols-10", 11: "min-[2100px]:grid-cols-11", 12: "min-[2100px]:grid-cols-12"
};

function clampCol(n: unknown, fb: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fb;
  return Math.min(12, Math.max(1, Math.round(v)));
}

export function gridClass(cfg?: Partial<GridConfig>): string {
  const c: { mobile?: unknown; tablet?: unknown; desktop?: unknown; kiosk?: unknown } = cfg?.cols ?? {};
  const m = clampCol(c.mobile, 2);
  const t = clampCol(c.tablet, 3);
  const d = clampCol(c.desktop, 4);
  const k = clampCol(c.kiosk, 5);
  return `mx-auto w-full max-w-[1600px] grid gap-3 ${COLS[m]} ${COLS_MD[t]} ${COLS_LG[d]} ${COLS_KIOSK[k]}`;
}

function AppCard({ app, onClick, compact, showName }: { app: AppRegistry; onClick: () => void; compact: boolean; showName: boolean }) {
  const [imgOk, setImgOk] = useState(true);
  // 배경없음(none): 투명. 이미지: cover 자동대응 + 가독성 오버레이. 단색: 지정색.
  const cardStyle: React.CSSProperties =
    app.bgType === "none"
      ? { background: "transparent", boxShadow: "none" }
      : app.bgType === "image" && app.bgImage
        ? { backgroundImage: `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.82)), url(${app.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
        : { backgroundColor: app.bgColor || "#FFFFFF" };
  const iconSize = compact
    ? "w-[clamp(40px,8vw,64px)] h-[clamp(40px,8vw,64px)]"
    : "w-[clamp(48px,6vw,80px)] h-[clamp(48px,6vw,80px)]";
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      style={cardStyle}
      className={`${compact ? "" : "aspect-[4/5] shadow hover:shadow-lg"} min-h-[48px] min-w-[48px] rounded-2xl ${compact ? "p-1" : "bg-white p-4"} flex flex-col items-center justify-center gap-1`}
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
          className={`${iconSize} object-contain`}
        />
      ) : (
        <span className="text-[clamp(28px,4vw,56px)]" aria-hidden>
          {app.name.slice(0, 1)}
        </span>
      )}
      {showName && !compact && (
        <span className="font-semibold text-center text-[clamp(14px,2vw,16px)] md:text-[clamp(16px,2.5vw,18px)] lg:text-[clamp(16px,1.5vw,18px)] min-[1900px]:text-[clamp(24px,2vw,32px)] min-[2100px]:text-[clamp(32px,1.5vw,48px)]">
          {app.name}
        </span>
      )}
      {showName && compact && (
        <span className="text-center leading-tight text-[clamp(10px,1.6vw,13px)] text-gray-700 line-clamp-1">
          {app.name}
        </span>
      )}
      {app.description && !compact && (
        <span className="text-gray-500 text-center line-clamp-2 text-[clamp(12px,1.5vw,18px)] min-[1900px]:text-[clamp(18px,1.2vw,24px)]">
          {app.description}
        </span>
      )}
      {app.openMode === "direct" && !compact && (
        <span className="rounded-full border px-2 py-0.5 text-[clamp(10px,1.2vw,12px)] text-gray-500">외부 앱 · 뒤로가기로 복귀</span>
      )}
    </motion.button>
  );
}

// uiux 3.2 기본 + 관리자 밀도 설정 반영 (한 화면 최대 아이콘 모드 지원)
export function AppGrid({ apps, onAppClick, config }: AppGridProps) {
  const compact = config?.density === "compact";
  const showName = config?.showName !== false;
  return (
    <div className={gridClass(config)} role="grid" aria-label="앱 런처">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} onClick={() => onAppClick(app.slug)} compact={compact} showName={showName} />
      ))}
    </div>
  );
}
