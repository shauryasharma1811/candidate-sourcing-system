"use client";

import { Bell, Circle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { notificationService } from "@/services/notification-service";
import { NotificationListItem } from "@/types";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications";

const PREVIEW_COUNT = 5;

const EVENT_LABEL: Record<string, string> = {
  application_submitted: "New application submitted",
  submission_confirmation: "Submission confirmation sent",
  status_change: "Application status changed",
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const [unreadCount, decrementUnread] = useUnreadNotificationCount();
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleToggle() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setIsLoadingPreview(true);
      notificationService
        .list(1, PREVIEW_COUNT)
        .then(({ notifications }) => setItems(notifications))
        .catch(() => setItems([]))
        .finally(() => setIsLoadingPreview(false));
    }
  }

  async function handleMarkRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, status: "read", read_at: new Date().toISOString() } : n)));
    decrementUnread();
    try {
      await notificationService.markRead(id);
    } catch {
      // best-effort; a stale badge self-corrects on the next poll
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-surface-muted hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] animate-scale-in items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white dark:bg-red-500">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right animate-scale-in rounded-2xl border border-border bg-surface shadow-token-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unreadCount > 0 && <span className="text-xs text-muted">{unreadCount} unread</span>}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoadingPreview && (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-shimmer" />
                ))}
              </div>
            )}

            {!isLoadingPreview && items.length === 0 && (
              <p className="p-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
            )}

            {!isLoadingPreview &&
              items.map((n) => {
                const isUnread = n.status !== "read";
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2 border-b border-border/60 px-4 py-3 transition-colors duration-200 last:border-0 ${
                      isUnread ? "bg-primary-soft/60" : ""
                    }`}
                  >
                    <span className="mt-1.5 shrink-0">
                      {isUnread ? (
                        <Circle className="h-2 w-2 fill-primary text-primary" />
                      ) : (
                        <span className="block h-2 w-2" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{n.subject || EVENT_LABEL[n.event] || n.event}</p>
                      <p className="mt-0.5 text-xs text-muted">{formatRelative(n.created_at)}</p>
                    </div>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        className="shrink-0 text-xs font-medium text-primary transition-opacity hover:opacity-75"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                );
              })}
          </div>

          <Link
            href="/admin/notifications"
            onClick={() => setIsOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary transition-colors duration-200 hover:bg-surface-muted"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
