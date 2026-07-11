"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

interface NavProps {
  /** Authenticated user's email, shown at the bottom of the desktop sidebar. */
  email?: string | null;
}

/** Single source of truth for nav items (label + path + icon). */
const NAV_ITEMS: { label: string; href: string; icon: React.ReactNode }[] = [
  { label: "Dashboard", href: "/", icon: <GridIcon /> },
  { label: "Accounts", href: "/accounts", icon: <WalletIcon /> },
  { label: "Transactions", href: "/transactions", icon: <ListIcon /> },
  { label: "Transfer", href: "/transfer", icon: <SwapIcon /> },
  { label: "Categories", href: "/categories", icon: <TagIcon /> },
  { label: "Reports", href: "/reports", icon: <ChartIcon /> },
  { label: "Settings", href: "/settings", icon: <CogIcon /> },
];

/**
 * Navigation. On desktop (lg+) it renders a fixed dark left sidebar with the
 * nav links, the user's email, and a logout button. On mobile it renders a
 * fixed bottom nav bar with the five most important destinations as icons.
 */
export default function Nav({ email }: NavProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Clear any cached client state, then redirect to CF Access logout
      // so the user is fully signed out (not silently re-authenticated).
      const cfTeam = "ppramod";
      const returnTo = window.location.origin;
      window.location.href = `https://${cfTeam}.cloudflareaccess.com/cdn-cgi/access/logout?returnTo=${encodeURIComponent(returnTo)}`;
    }
  }

  // Items shown in the mobile bottom bar (max 5 for thumb reachability).
  const mobileItems = NAV_ITEMS.filter((i) =>
    ["/", "/accounts", "/transactions", "/transfer", "/reports"].includes(i.href)
  );

  return (
    <>
      {/* ---------- Desktop sidebar (lg and up) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-gray-900 text-gray-300 lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <WalletIcon className="h-5 w-5" />
          </span>
          <span className="text-base font-semibold text-white">Ledger</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <span className="shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-800 p-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-medium text-gray-200">
              {initials(email)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-300" title={email ?? ""}>
              {email ?? "Signed in"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
          >
            <LogoutIcon />
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* ---------- Mobile bottom nav bar ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {mobileItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-emerald-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <span className={cn(active ? "text-emerald-600" : "text-gray-400")}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-gray-500 transition-colors hover:text-gray-700"
        >
          <span className="text-gray-400">
            <LogoutIcon />
          </span>
          {loggingOut ? "…" : "Sign out"}
        </button>
      </nav>
    </>
  );
}

/** A route is active when it equals the pathname, or is its prefix (nested). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Derive initials from an email for the avatar bubble. */
function initials(email?: string | null): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

/* ----------------------------- Icons --------------------------------------- */
/* Inline SVGs keep the bundle tiny and avoid an icon-library dependency. Each
 * accepts an optional className for sizing/coloring via currentColor. */

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 012-2h12a2 2 0 012 2v0H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinejoin="round" />
      <circle cx="16" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function SwapIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 7h13l-3-3M17 17H4l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 14l3-4 4 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
