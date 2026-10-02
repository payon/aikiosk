import { Shell } from "@/components/Shell";
import { LauncherClient } from "@/components/LauncherClient";
import type { AppRegistry } from "@/types/app";
import type { CSSProperties } from "react";

const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    // 항상 최신 (어드민 변경 즉시 반영, 캐시 없음)
    const r = await fetch(`${BACKEND}${path}`, { cache: "no-store" });
    if (!r.ok) throw new Error("bad");
    const j = await r.json();
    return (j.success ? j.data : fallback) as T;
  } catch {
    return fallback;
  }
}

interface Platform {
  platformName: string;
  logoUrl: string;
  pwaIconUrl: string;
  announcement: string;
  idleTimeoutMin: number;
  backgroundType: string;
  backgroundColor: string;
  backgroundImage: string;
  gridDensity: string;
  gridCols: { mobile: number; tablet: number; desktop: number; kiosk: number };
  showAppName: boolean;
}

// 서버 렌더: 첫 HTML에 아이콘·글자가 바로 박힌다 (빈 화면 방지)
export default async function LauncherPage({ searchParams }: { searchParams?: { cat?: string } }) {
  const [apps, cats, platform] = await Promise.all([
    get<AppRegistry[]>("/api/apps", []),
    get<{ name: string; count: number }[]>("/api/categories", []),
    get<Platform>("/api/platform", {
      platformName: "RustKorea Hub", logoUrl: "/logo.svg", pwaIconUrl: "", announcement: "", idleTimeoutMin: 3,
      backgroundType: "color", backgroundColor: "#FFF7ED", backgroundImage: "",
      gridDensity: "comfortable", gridCols: { mobile: 2, tablet: 3, desktop: 4, kiosk: 5 },
      showAppName: true
    })
  ]);
  const bodyStyle: CSSProperties =
    platform.backgroundType === "image" && platform.backgroundImage
      ? { backgroundColor: platform.backgroundColor || "#FFF7ED", backgroundImage: `url(${platform.backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }
      : { backgroundColor: platform.backgroundColor || "#FFF7ED" };
  return (
    <Shell apps={apps} brand={platform.platformName} logo={platform.logoUrl} idleMin={platform.idleTimeoutMin} bodyStyle={bodyStyle}>
      <LauncherClient
        initialApps={apps}
        initialCats={cats}
        announcement={platform.announcement}
        initialCat={typeof searchParams?.cat === "string" ? searchParams.cat : "전체"}
        grid={{ density: platform.gridDensity === "compact" ? "compact" : "comfortable", cols: platform.gridCols, showName: platform.showAppName !== false }}
      />
    </Shell>
  );
}
