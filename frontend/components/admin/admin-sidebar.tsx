"use client";

import {
  Bell,
  Briefcase,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { NotificationBell } from "@/components/admin/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/requisitions", label: "Requisitions", icon: Briefcase },
  { href: "/admin/applications", label: "Applications", icon: Users },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [unreadCount] = useUnreadNotificationCount();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary-soft text-primary"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
            <span className="flex-1">{label}</span>
            {label === "Notifications" && unreadCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-none text-white dark:bg-red-500">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md md:hidden">
        <span className="text-base font-semibold text-foreground">Admin Console</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-fade-in-up flex-col border-r border-border bg-surface pb-4 pt-4 shadow-token-lg">
            <div className="mb-4 flex items-center justify-between px-4">
              <span className="text-base font-semibold text-foreground">Admin Console</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto border-t border-border px-3 pt-3">
              <p className="truncate px-3 text-xs text-muted">{user?.email}</p>
              <button
                type="button"
                onClick={logout}
                className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface pb-4 pt-6 md:flex">
        <div className="mb-6 flex items-center justify-between px-4">
          <span className="text-lg font-semibold text-foreground">Admin Console</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
        <NavLinks />
        <div className="mt-auto border-t border-border px-3 pt-3">
          <p className="truncate px-3 text-xs text-muted">{user?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
