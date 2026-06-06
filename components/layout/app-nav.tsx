"use client";

import Link from "next/link";
import { BarChart3, Home, Building2, BookOpen, FileDown, Map, BookMarked, Users, FileSearch, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "./nav-link";

export function AppNav() {
  return (
    <nav
      className="fixed inset-x-0 top-0 z-40 h-14"
      style={{
        background: "linear-gradient(180deg, hsl(0 0% 100% / 0.92) 0%, hsl(220 25% 98% / 0.85) 100%)",
        borderBottom: "1px solid hsl(220 20% 88% / 0.8)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        boxShadow: "0 1px 0 hsl(220 20% 88% / 0.5), 0 4px 24px hsl(220 20% 0% / 0.04)",
      }}
    >
      <div className="container mx-auto flex h-full max-w-7xl items-center gap-6 px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold tracking-tight"
          aria-label="Accueil BizDev OS"
          style={{ color: "hsl(231 72% 36%)" }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: "linear-gradient(135deg, hsl(231 72% 42%) 0%, hsl(231 72% 30%) 100%)",
              boxShadow: "0 2px 8px hsl(231 72% 38% / 0.35), inset 0 1px 0 hsl(231 50% 60% / 0.3)",
            }}
          >
            <BarChart3 className="h-4 w-4 text-white" />
          </span>
          <span className="hidden sm:inline">BizDev OS</span>
        </Link>

        {/* Séparateur vertical */}
        <div className="h-5 w-px bg-border" />

        {/* Liens nav */}
        <div className="flex items-center gap-1">
          <NavLink href="/" label="Cockpit" icon={Home} />
          <NavLink href="/comptes" label="Plan de comptes" icon={Building2} />
          <NavLink href="/connaissance" label="Base de connaissance" icon={BookOpen} />
          <NavLink href="/roadmap" label="Roadmap" icon={Map} />
          <NavLink href="/methodologie" label="Méthode" icon={BookMarked} />
          <NavLink href="/revue-partners" label="Revue Partners" icon={Users} />
          <NavLink href="/ao" label="AO Pipeline" icon={FileSearch} />
          <NavLink href="/revue-actions" label="Revue Actions" icon={ClipboardCheck} />
        </div>

        {/* Rapport PDF à droite */}
        <div className="ml-auto">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-medium"
            style={{
              background: "linear-gradient(135deg, hsl(231 72% 40%) 0%, hsl(231 72% 32%) 100%)",
              border: "1px solid hsl(231 72% 32%)",
              color: "white",
              boxShadow: "0 1px 2px hsl(231 72% 20% / 0.25), inset 0 1px 0 hsl(231 50% 60% / 0.2)",
            }}
          >
            <a
              href="/api/rapport/pdf"
              target="_blank"
              rel="noreferrer"
              aria-label="Télécharger le rapport PDF du portefeuille"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rapport PDF</span>
            </a>
          </Button>
        </div>
      </div>
    </nav>
  );
}
