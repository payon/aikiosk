import type { MetadataRoute } from "next";

const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";

async function platform() {
  try {
    const r = await fetch(`${BACKEND}/api/platform`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (j.success) return j.data;
    }
  } catch { /* 기본값 */ }
  return { platformName: "RustKorea Hub", primaryColor: "#0F766E", pwaIconUrl: "" };
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const p = await platform();
  const icons: MetadataRoute.Manifest["icons"] = [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
  ];
  if (p.pwaIconUrl) icons.unshift({ src: p.pwaIconUrl, sizes: "any", type: "image/png" });
  return {
    name: p.platformName || "RustKorea Hub",
    short_name: "RK Hub",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: p.primaryColor || "#0F766E",
    icons
  };
}
