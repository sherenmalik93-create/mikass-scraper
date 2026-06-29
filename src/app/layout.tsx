import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vidfast Scraper — m3u8 Stream Extractor",
  description: "Extract raw m3u8 stream URLs and playlist content from vidfast.pro and vidlink providers via vaplayer.ru backend API. CORS proxy included.",
  keywords: ["vidfast", "vidlink", "scraper", "m3u8", "HLS", "TMDB", "streaming", "Next.js"],
  authors: [{ name: "Vidfast Scraper" }],
  openGraph: {
    title: "Vidfast Scraper",
    description: "Raw m3u8 stream extractor for vidfast.pro and vidlink.",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
