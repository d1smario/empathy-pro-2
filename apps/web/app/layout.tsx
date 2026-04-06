import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { getMetadataBaseUrl, isSiteIndexingDisabled } from "@/lib/site-url";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const metadataBase = getMetadataBaseUrl();

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: {
    default: "Empathy Pro 2.0",
    template: "%s · Empathy Pro 2.0",
  },
  description: "Performance & metabolic adaptation platform",
  applicationName: "Empathy Pro 2.0",
  robots: isSiteIndexingDisabled()
    ? { index: false, follow: false, googleBot: { index: false, follow: false } }
    : { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Empathy Pro 2.0",
    title: "Empathy Pro 2.0",
    description: "Performance & metabolic adaptation platform",
  },
  twitter: {
    card: "summary_large_image",
    title: "Empathy Pro 2.0",
    description: "Performance & metabolic adaptation platform",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "32x32" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-black font-sans text-white antialiased">
        <a
          href="#main-content"
          className="fixed left-4 top-0 z-[300] -translate-y-full rounded-b-lg border border-white/20 bg-purple-950/95 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/40 transition focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
        >
          Salta al contenuto
        </a>
        {children}
      </body>
    </html>
  );
}
