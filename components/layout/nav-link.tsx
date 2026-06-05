"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function NavLink({ href, label, icon: Icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-all duration-150",
        isActive
          ? "font-medium text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      )}
      style={
        isActive
          ? {
              background: "linear-gradient(135deg, hsl(231 72% 38% / 0.08) 0%, hsl(231 60% 55% / 0.05) 100%)",
              boxShadow: "inset 0 1px 0 hsl(231 72% 38% / 0.15), 0 0 0 1px hsl(231 72% 38% / 0.12)",
            }
          : undefined
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
