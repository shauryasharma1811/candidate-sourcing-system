"use client";

import { Briefcase } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/features/auth/auth-context";

export function SiteHeader() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-foreground transition-opacity hover:opacity-80">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </span>
          Careers
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
          <Link
            href="/jobs"
            className="rounded-lg px-3 py-2 text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
          >
            Browse Jobs
          </Link>
          {isAuthenticated && user?.role === "Candidate" ? (
            <>
              <Link
                href="/applications/mine"
                className="rounded-lg px-3 py-2 text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
              >
                My Applications
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-2 text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg px-3 py-2 text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
            >
              Sign In
            </Link>
          )}
          <div className="ml-1 h-5 w-px bg-border" aria-hidden="true" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
