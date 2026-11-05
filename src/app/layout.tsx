import type { Metadata, Viewport } from "next";
import { Exo_2, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const exo = Exo_2({ subsets: ["latin"], weight: ["400", "600", "700", "900"], style: ["normal", "italic"], variable: "--font-exo" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Dümmer geht Immer",
  description: "Die Quizshow für Freunde",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${exo.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
