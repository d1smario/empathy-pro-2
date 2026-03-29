import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empathy Pro 2.0",
  description: "Performance & metabolic adaptation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
