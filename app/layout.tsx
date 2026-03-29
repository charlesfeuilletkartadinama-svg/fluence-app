import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NotificationCenter from "./components/NotificationCenter";
import OnboardingGuide from "./components/OnboardingGuide";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Test de Fluence - Académie de Guyane",
  description: "Plateforme de gestion et suivi des tests de fluence en lecture pour les établissements scolaires",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try { const t = localStorage.getItem('fluence-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch {}
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <NotificationCenter />
        <OnboardingGuide />
      </body>
    </html>
  );
}
