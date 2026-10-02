import type { AppRegistry } from "@/types/app";

// API 서버(백엔드)가 단일 소스. 프론트는 직접 DB를 읽지 않는다.
const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";

// Fallback seed when backend is unreachable (bootstrap only).
// NOTE: 예시 도메인 — 실제 값은 백엔드 PLATFORM_DOMAIN에서 옴 (H7 준수)
const seedDomain = () => process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "example.local";
export const SEED_APPS: AppRegistry[] = [
  { id: "seed-1", name: "러스트 라이브러리", slug: "library", targetUrl: `https://library.${seedDomain()}`, iconUrl: "/icons/library.svg", description: "디지털 에셋 라이브러리", displayOrder: 0 },
  { id: "seed-2", name: "AI Platform", slug: "aiplatform", targetUrl: `https://aiplatform.${seedDomain()}`, iconUrl: "/icons/ai.svg", description: "AI 솔루션 허브", displayOrder: 1 },
  { id: "seed-3", name: "헬스케어", slug: "healthcare", targetUrl: `https://healthcare.${seedDomain()}`, iconUrl: "/icons/health.svg", description: "헬스케어 대시보드", displayOrder: 2 }
];

let cache: { at: number; data: AppRegistry[] } | null = null;
const TTL = 60_000;

export async function getActiveApps(): Promise<AppRegistry[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  try {
    const r = await fetch(`${BACKEND}/api/apps`, { next: { revalidate: 60 } });
    if (!r.ok) throw new Error("backend");
    const j = await r.json();
    const rows = (j.data ?? []) as AppRegistry[];
    cache = { at: Date.now(), data: rows.length ? rows : SEED_APPS };
    return cache.data;
  } catch {
    return SEED_APPS;
  }
}

export function invalidateAppsCache() {
  cache = null;
}
