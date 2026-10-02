import { Shell } from "@/components/Shell";
import { LauncherClient } from "@/components/LauncherClient";
import type { AppRegistry } from "@/types/app";

const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`${BACKEND}${path}`, { next: { revalidate: 30 } });
    if (!r.ok) throw new Error("bad");
    const j = await r.json();
    return (j.success ? j.data : fallback) as T;
  } catch {
    return fallback;
  }
}

// 서버 렌더: 첫 HTML에 아이콘·글자가 바로 박힌다 (빈 화면 방지)
export default async function LauncherPage() {
  const [apps, cats, platform] = await Promise.all([
    get<AppRegistry[]>("/api/apps", []),
    get<{ name: string; count: number }[]>("/api/categories", []),
    get<{ platformName: string; announcement: string; idleTimeoutMin: number }>(
      "/api/platform",
      { platformName: "RustKorea Hub", announcement: "", idleTimeoutMin: 3 }
    )
  ]);
  return (
    <Shell apps={apps} brand={platform.platformName} idleMin={platform.idleTimeoutMin}>
      <LauncherClient initialApps={apps} initialCats={cats} brand={platform.platformName} announcement={platform.announcement} />
    </Shell>
  );
}
