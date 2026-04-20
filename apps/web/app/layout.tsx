import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Serif_Display, Manrope, Outfit } from "next/font/google";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const dashboardFont = Outfit({
  subsets: ["latin"],
  variable: "--font-dashboard",
});

export const metadata: Metadata = {
  title: "Salon Fun",
  description: "Agenda digital para salões",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${dashboardFont.variable}`}>{children}</body>
    </html>
  );
}
