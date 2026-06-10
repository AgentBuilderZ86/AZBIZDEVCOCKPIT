"use client";

import { BarChart3, Home, Building2, FileDown, Map, BookMarked, BookOpen, Users, FileSearch, ClipboardCheck, Orbit, Radio } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { NavLink } from "./nav-link";
import { DropZoneDialog } from "@/components/drop-zone/drop-zone-dialog";
import { CopilotCommand } from "@/components/copilot/copilot-command";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, hsl(245 80% 60% / 0.6), hsl(275 75% 62% / 0.5), hsl(190 85% 55% / 0.5), transparent)" }}
      />
      <div className="container mx-auto flex h-full max-w-7xl items-center gap-3 px-4">
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

        {/* Navigation principale (quotidien) */}
        <div className="flex items-center gap-0.5">
          <NavLink href="/" label="Cockpit" icon={Home} />
          <NavLink href="/galaxy" label="Galaxie" icon={Orbit} />
          <NavLink href="/veille" label="Veille" icon={Radio} />
          <NavLink href="/comptes" label="Comptes" icon={Building2} />
          <NavLink href="/revue-partners" label="Partners" icon={Users} />
          <NavLink href="/revue-actions" label="Actions" icon={ClipboardCheck} />
        </div>

        {/* Actions à droite */}
        <div className="ml-auto flex items-center gap-2">
          <CopilotCommand />
          <DropZoneDialog />
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
            <a href="/api/rapport/pdf" target="_blank" rel="noreferrer" aria-label="Télécharger le rapport PDF du portefeuille">
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Rapport</span>
            </a>
          </Button>
          <ThemeToggle />
          {/* Avatar : profil + sections secondaires regroupées ici */}
          <UserButton afterSignOutUrl="/sign-in">
            <UserButton.MenuItems>
              <UserButton.Link label="AO Pipeline" labelIcon={<FileSearch className="h-4 w-4" />} href="/ao" />
              <UserButton.Link label="Base de connaissance" labelIcon={<BookOpen className="h-4 w-4" />} href="/connaissance" />
              <UserButton.Link label="Roadmap" labelIcon={<Map className="h-4 w-4" />} href="/roadmap" />
              <UserButton.Link label="Méthodologie" labelIcon={<BookMarked className="h-4 w-4" />} href="/methodologie" />
              <UserButton.Action label="manageAccount" />
              <UserButton.Action label="signOut" />
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </div>
    </nav>
  );
}
