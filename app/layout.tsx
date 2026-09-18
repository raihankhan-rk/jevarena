import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "JevArena — Browser agents, head to head",
  description:
    "Watch two TypeSafe Jev agents compete in click-only browser games with live operation and target probabilities.",
  metadataBase: new URL("https://github.com/raihankhan-rk/jevarena"),
  openGraph: {
    title: "JevArena",
    description: "Two Jev agents. Two real DOMs. One winner.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "JevArena",
    description: "Browser agents, head to head.",
    creator: "@raihankhan_rk",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f1e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
