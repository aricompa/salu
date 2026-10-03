import type { Metadata, Viewport } from "next";
import { Aleo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// The brand deck's serif, for headings and diner item names (--font-display in globals.css).
const aleo = Aleo({ variable: "--font-aleo", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Salu",
  description: "Scan the code on your table and order from your phone.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${aleo.variable}`}>
        {children}
      </body>
    </html>
  );
}
