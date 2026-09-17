"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  BookOpen,
  Dumbbell,
  FolderKanban,
  MessagesSquare,
  Map,
  AlertTriangle,
  TrendingUp,
  Settings,
  Terminal,
  Flame,
  Languages,
} from "lucide-react";

import { useQuery } from "convex/react";

import { cn } from "@/lib/utils";
import { useAppUser } from "@/lib/use-app-user";
import { api } from "@/convex/_generated/api";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Locale } from "@/types/domain";

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAppUser();
  const summary = useQuery(api.dashboard.getDashboardSummary, user ? { userId: user._id } : "skip");
  const streak = summary?.user.currentStreak ?? 0;
  const { t, locale, setLocale } = useLocale();

  const NAV_ITEMS = [
    { href: "/dashboard", label: t.sidebar.dashboard, icon: LayoutDashboard },
    { href: "/learn", label: t.sidebar.learn, icon: BookOpen },
    { href: "/practice", label: t.sidebar.practice, icon: Dumbbell },
    { href: "/knowledge-map", label: t.sidebar.knowledgeMap, icon: Map },
    { href: "/mistakes", label: t.sidebar.mistakes, icon: AlertTriangle },
    { href: "/progress", label: t.sidebar.progress, icon: TrendingUp },
    { href: "/projects", label: t.sidebar.projects, icon: FolderKanban },
    // { href: "/interview", label: t.sidebar.interview, icon: MessagesSquare },
    { href: "/settings", label: t.sidebar.settings, icon: Settings },
  ] as const;

  const LOCALES: { value: Locale; short: string }[] = [
    { value: "en", short: "EN" },
    { value: "uk", short: "UK" },
  ];

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-surface/60">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4 font-mono text-sm font-semibold">
        <Terminal className="h-4 w-4 text-accent" aria-hidden />
        {t.sidebar.appName}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* <div className="flex items-center gap-1.5 border-t border-border px-3 py-2">
        <Languages className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex gap-1" role="group" aria-label={t.sidebar.language}>
          {LOCALES.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLocale(l.value)}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors",
                locale === l.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              aria-pressed={locale === l.value}
            >
              {l.short}
            </button>
          ))}
        </div>
      </div> */}

      <div className="flex items-center justify-between border-t border-border p-3">
        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <Flame className={cn("h-3.5 w-3.5", streak > 0 && "text-accent")} aria-hidden />
          {streak} {streak === 1 ? t.sidebar.day : t.sidebar.days}
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </aside>
  );
}
