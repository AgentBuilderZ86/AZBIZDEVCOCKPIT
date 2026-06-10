"use client";

import { BarChart3, Home, Building2, BookOpen, FileDown, Map, BookMarked, Users, FileSearch, ClipboardCheck } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { NavLink } from "./nav-link";
import { DropZoneDialog } from "@/components/drop-zone/drop-zone-dialog";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
      {/* liseré dégradé Aurora en bas de la nav */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, hsl(245 80% 60% / 0.6), hsl(275 75% 62% / 0.5), hsl(190 85% 55% / 0.5), transparent)" }}
      />
      <div className="container mx-auto flex h-full max-w-7xl items-center gap-4 px-4">
        {/* Logo */}
        <a href="/" className="group flex items-center gap-2.5" aria-label="Accueil BizDev OS">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-aurora-gradient shadow-glow transition-transform duration-300 group-hover:scale-105">
            <BarChart3 className="h-5 w-5 text-white" strokeWidth={2.5} />
            <span className="absolute inset-0 rounded-xl opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-70 bg-aurora-gradient" />
          </span>
          <span className="hidden font-display text-sm font-bold tracking-tight sm:inline">
            BizDev <span className="text-gradient">OS</span>
          </span>
        </a>

        <div className="mx-1 hidden h-5 w-px bg-border md:block" />

        {/* Liens nav */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          <NavLink href="/" label="Cockpit" icon={Home} />
          <NavLink href="/comptes" label="Plan de comptes" icon={Building2} />
          <NavLink href="/connaissance" label="Connaissance" icon={BookOpen} />
          <NavLink href="/roadmap" label="Roadmap" icon={Map} />
          <NavLink href="/methodologie" label="Méthode" icon={BookMarked} />
          <NavLink href="/revue-partners" label="Partners" icon={Users} />
          <NavLink href="/ao" label="AO Pipeline" icon={FileSearch} />
          <NavLink href="/revue-actions" label="Revue Actions" icon={ClipboardCheck} />
        </div>

        {/* Actions à droite */}
        <div className="ml-auto flex items-center gap-2">
          <DropZoneDialog />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-medium"
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
          <ThemeToggle />
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </nav>
  );
}
