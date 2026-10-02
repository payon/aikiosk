import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RustKorea Hub",
    short_name: "RK Hub",
    start_url: "/",
    display: "fullscreen",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#C2410C",
    icons: [{ src: "/logo.svg", sizes: "512x512", type: "image/svg+xml" }]
  };
}
