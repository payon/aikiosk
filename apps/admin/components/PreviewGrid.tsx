"use client";

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
}

// 런처 미리보기용 — 실제 런처와 동일한 그리드 규칙 (uiux 3.2)
export function PreviewGrid({ apps }: { apps: AppRegistry[] }) {
  const active = apps.filter((a) => a.isActive !== false);
  return (
    <div className="border rounded-2xl overflow-hidden">
      <div className="bg-white border-b px-4 min-h-[48px] flex items-center justify-between">
        <b className="text-[clamp(16px,2vw,24px)]">런처 미리보기</b>
        <span className="text-[clamp(12px,1.5vw,18px)] text-gray-500">{active.length}개 앱</span>
      </div>
      <div className="bg-gray-50 p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {active.map((app) => (
          <div key={app.id} className="aspect-[4/5] min-h-[48px] rounded-2xl bg-white p-4 shadow flex flex-col items-center justify-center gap-2">
            <span className="text-[clamp(32px,4vw,64px)]" aria-hidden>{app.name.slice(0, 1)}</span>
            <span className="font-semibold text-center text-[clamp(14px,2vw,16px)]">{app.name}</span>
            <span className="text-[clamp(12px,1.5vw,18px)] text-gray-500">{app.category || "전체"}</span>
          </div>
        ))}
        {active.length === 0 && <p className="text-[clamp(14px,2vw,16px)] text-gray-500">표시할 앱이 없습니다</p>}
      </div>
    </div>
  );
}
