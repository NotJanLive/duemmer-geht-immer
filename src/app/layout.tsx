import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dümmer geht Immer",
  description: "Die ultimative Quizshow für Freunde",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
