import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { AppNav } from "@/components/layout/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cockpit Comptes — Adil BizDev OS",
  description: "Pilotage du portefeuille de comptes BizDev (source de vérité : Notion).",
  manifest: "/manifest.json",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <AppNav />
        <div className="pt-14">
          {children}
        </div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
