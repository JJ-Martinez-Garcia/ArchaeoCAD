import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: "ArqueoCAD Mobile · Planimetría de excavación",
    description: "Abre, revisa, mide y separa las capas de planos DXF y SVG desde el móvil. El procesamiento se realiza en tu dispositivo.",
    applicationName: "ArqueoCAD Mobile",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      title: "ArqueoCAD Mobile",
      description: "Planimetría de excavación, en el terreno.",
      images: [{ url: `${origin}/og.png`, width: 1750, height: 907, alt: "ArqueoCAD Mobile, planimetría de excavación en el terreno" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ArqueoCAD Mobile",
      description: "Planimetría de excavación, en el terreno.",
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#111719",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
