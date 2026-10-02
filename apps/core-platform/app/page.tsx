import { Shell } from "@/components/Shell";
import { LauncherClient } from "@/components/LauncherClient";
import type { AppRegistry } from "@/types/app";
import type { CSSProperties } from "react";

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

interface Platform {
  platformName: string;
  announcement: string;
  idleTimeoutMin: number;
  backgroundType: string;
  backgroundColor: string;
  backgroundImage: string;
}

// 서버 렌더: 첫 HTML에 아이콘·글자가 바로 박힌다 (빈 화면 방지)
export default async function LauncherPage() {
  const [apps, cats, platform] = await Promise.all([
    get<AppRegistry[]>("/api/apps", []),
    get<{ name: string; count: number }[]>("/api/categories", []),
    get<Platform>("/api/platform", {
      platformName: "RustKorea Hub", announcement: "", idleTimeoutMin: 3,
      backgroundType: "color", backgroundColor: "#FFF7ED", backgroundImage: ""
    })
  ]);
  const bodyStyle: CSSProperties =
    platform.backgroundType === "image" && platform.backgroundImage
      ? { backgroundColor: platform.backgroundColor || "#FFF7ED", backgroundImage: `url(${platform.backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }
      : { backgroundColor: platform.backgroundColor || "#FFF7ED" };
  return (
    <Shell apps={apps} brand={platform.platformName} idleMin={platform.idleTimeoutMin} bodyStyle={bodyStyle}>
      <LauncherClient initialApps={apps} initialCats={cats} announcement={platform.announcement} />
    </Shell>
  );
}
