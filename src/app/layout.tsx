import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MegaXtoon — Where Cartoon Lovers Unite",
  description:
    "Watch your favorite cartoon series online. Explore trending shows, build your watchlist, earn XP, and level up!",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "MegaXtoon",
    description: "Where Cartoon Lovers Unite",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
