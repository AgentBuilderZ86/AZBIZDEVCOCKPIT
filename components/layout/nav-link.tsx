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
        "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all duration-200",
        isActive
          ? "font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-lg border border-primary/30 bg-primary/10"
          style={{ boxShadow: "0 0 18px -6px hsl(var(--primary) / 0.6)" }}
        />
      )}
      <Icon className={cn("relative h-3.5 w-3.5 shrink-0", isActive && "text-primary")} />
      <span className="relative hidden lg:inline">{label}</span>
    </Link>
  );
}
