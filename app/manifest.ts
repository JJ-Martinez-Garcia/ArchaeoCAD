import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ArqueoCAD Mobile",
    short_name: "ArqueoCAD",
    description: "Planimetría arqueológica: visor, capas, medición y exportación DXF/SVG.",
    start_url: "/",
    display: "standalone",
    background_color: "#111719",
    theme_color: "#111719",
    lang: "es",
    orientation: "any",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
