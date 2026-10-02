import type { MetadataRoute } from "next";

const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let pwaIcon = "";
  let name = "RustKorea Hub";
  try {
    const r = await fetch(`${BACKEND}/api/platform`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (j.success) {
        if (j.data?.platformName) name = j.data.platformName;
        if (j.data?.pwaIconUrl) pwaIcon = j.data.pwaIconUrl;
      }
    }
  } catch { /* 기본값 */ }
  const icons: MetadataRoute.Manifest["icons"] = [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
  ];
  if (pwaIcon) icons.unshift({ src: pwaIcon, sizes: "any", type: "image/png" });
  return {
    name,
    short_name: "RK Hub",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#C2410C",
    icons
  };
}
