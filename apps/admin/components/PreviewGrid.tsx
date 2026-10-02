"use client";
import { useState } from "react";

export interface AppRegistry {
  id: string;
  name: string;
  slug: string;
  targetUrl: string;
  iconUrl: string;
  description?: string;
  displayOrder: number;
  isActive?: boolean;
  category?: string;
  stripPrefix?: boolean;
  openMode?: "embed" | "direct";
  openTarget?: "self" | "blank";
  bgType?: string;
  bgColor?: string;
  bgImage?: string;
  links?: { label: string; url: string }[];
}

// uiux 3.2 대응 디바이스 프리셋 (너비 px → 기대 열수)
const DEVICES = [
  { label: "모바일", width: 390, cols: 2, note: "360~430px" },
  { label: "태블릿 7~10인치", width: 768, cols: 3, note: "768px" },
  { label: "태블릿 11인치+", width: 1024, cols: 3, note: "1024px" },
  { label: "데스크탑", width: 1440, cols: 4, note: "1440px" },
  { label: "데스크탑 FHD", width: 1920, cols: 4, note: "1920px" },
  { label: "키오스크 21~32인치", width: 1080, cols: 4, note: "1080×1920 세로" },
  { label: "키오스크 24·27인치", width: 1080, cols: 4, note: "1080×1920 세로" },
  { label: "키오스크 43인치", width: 2160, cols: 5, note: "2160×3840 세로" },
  { label: "키오스크 55인치", width: 2160, cols: 5, note: "2160×3840 세로" }
];

// 런처 미리보기 + 디바이스 랩 — 실제 런처와 동일한 그리드 규칙을 컨테이너 쿼리로 재현
export function PreviewGrid({ apps }: { apps: AppRegistry[] }) {
  const [di, setDi] = useState(0);
  const d = DEVICES[di];
  const active = apps.filter((a) => a.isActive !== false);
  return (
    <div className="border rounded-2xl overflow-hidden">
      <div className="bg-white border-b px-4 min-h-[48px] flex flex-wrap items-center gap-2">
        <b className="text-[clamp(16px,2vw,24px)]">런처 미리보기</b>
        <span className="text-[clamp(12px,1.5vw,18px)] text-gray-500">{active.length}개 앱</span>
        <select className="min-h-[48px] border rounded-lg px-2 ml-auto text-[clamp(13px,2vw,15px)]" value={di}
          onChange={(e) => setDi(Number(e.target.value))} aria-label="디바이스 선택">
          {DEVICES.map((x, i) => (
            <option key={`${x.label}-${i}`} value={i}>{x.label} ({x.width}px → {x.cols}열)</option>
          ))}
        </select>
      </div>
      <style>{`
        .pv-stage { container-type: inline-size; margin: 0 auto; background: #f9fafb; }
        .pv-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; padding: 12px; }
        @container (min-width: 768px) { .pv-grid { grid-template-columns: repeat(3,1fr); } }
        @container (min-width: 1025px) { .pv-grid { grid-template-columns: repeat(4,1fr); } }
        @container (min-width: 2100px) { .pv-grid { grid-template-columns: repeat(5,1fr); } }
      `}</style>
      <p className="bg-white px-4 py-2 text-[clamp(12px,1.5vw,14px)] text-gray-500 border-b">
        {d.label} · {d.note} · 기대 {d.cols}열 (실제 열수는 스테이지 너비 기준 자동)
      </p>
      <div className="overflow-x-auto bg-gray-100">
        <div className="pv-stage" style={{ width: d.width, maxWidth: "none" }}>
          <div className="pv-grid">
            {active.map((app) => (
              <div key={app.id}
                style={app.bgType === "image" && app.bgImage
                  ? { backgroundImage: `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.82)), url(${app.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { backgroundColor: app.bgColor || "#FFFFFF" }}
                className="rounded-2xl p-3 shadow flex flex-col items-center justify-center gap-1"
              >
                <span className="font-semibold text-center" style={{ fontSize: "clamp(14px,2cqw,20px)" }}>{app.name}</span>
                <span style={{ fontSize: "clamp(11px,1.5cqw,14px)", color: "#6b7280" }}>{app.category || "전체"}{app.openMode === "direct" ? " · 외부" : ""}</span>
              </div>
            ))}
            {active.length === 0 && <p>표시할 앱이 없습니다</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
