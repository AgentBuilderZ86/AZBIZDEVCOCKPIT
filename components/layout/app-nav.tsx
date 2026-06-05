import Link from "next/link";
import { BarChart3, Home, Building2, BookOpen, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "./nav-link";

export function AppNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-full max-w-7xl items-center gap-6 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold"
          aria-label="Accueil BizDev OS"
        >
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">BizDev OS</span>
        </Link>

        <div className="flex items-center gap-4">
          <NavLink href="/" label="Cockpit" icon={Home} />
          <NavLink href="/comptes" label="Plan de comptes" icon={Building2} />
          <NavLink href="/connaissance" label="Base de connaissance" icon={BookOpen} />
        </div>

        <div className="ml-auto">
          <Button asChild variant="ghost" size="sm">
            <a
              href="/api/rapport/pdf"
              target="_blank"
              rel="noreferrer"
              aria-label="Télécharger le rapport PDF du portefeuille"
            >
              <FileDown className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Rapport PDF</span>
            </a>
          </Button>
        </div>
      </div>
    </nav>
  );
}
