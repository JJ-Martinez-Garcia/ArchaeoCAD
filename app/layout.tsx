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
    title: "ArchaeoCAD Mobile · Planimetría de excavación",
    description: "Abre, revisa, mide y separa las capas de planos DXF y SVG desde el móvil. El procesamiento se realiza en tu dispositivo.",
    applicationName: "ArchaeoCAD Mobile",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "ArchaeoCAD",
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: [{ url: "/apple-touch-icon.png", sizes: "192x192", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      title: "ArchaeoCAD Mobile",
      description: "Planimetría de excavación, en el terreno.",
      images: [{ url: `${origin}/og.png`, width: 1750, height: 907, alt: "ArchaeoCAD Mobile, planimetría de excavación en el terreno" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ArchaeoCAD Mobile",
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
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ArchaeoCAD" />
        <link rel="apple-touch-icon" sizes="192x192" href="/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
