"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LineChart,
  ListChecks,
  NotebookPen,
  Settings,
  TrendingUp,
} from "lucide-react";

import { isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/stocks", label: "Stocks", icon: LineChart },
  { href: "/watchlist", label: "Watchlist", icon: ListChecks },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/forecasts", label: "Forecasts", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur md:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-16 flex-1 flex-col items-center gap-1 px-2 py-2 text-xs",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
