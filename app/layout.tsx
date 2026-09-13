import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./phone.css";
import "./catalog.css";

export const viewport: Viewport = {width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content"};

export const metadata: Metadata = {
  title: "LyricForge — Lyric Video Studio",
  description: "Create lyric videos with precise timing, expressive typography, local transcription, and complete manual control.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
