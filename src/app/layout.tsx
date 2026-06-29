import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mkissa Scraper - mkissa.to Anime Stream Extractor",
  description: "Scrape anime streams from mkissa.to with HLS playback, CORS proxy, and stream extraction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
