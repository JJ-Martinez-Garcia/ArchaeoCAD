import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ArchaeoCAD Mobile",
    short_name: "ArchaeoCAD",
    description: "Planimetría arqueológica: visor, capas, medición y exportación DXF/SVG.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#111719",
    theme_color: "#111719",
    lang: "es",
    orientation: "any",
    categories: ["productivity", "utilities", "education"],
    prefer_related_applications: false,
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
