"use client";

import { Bell, Circle } from "lucide-react";
import { useEffect, useState } from "react";

import { Pagination } from "@/components/ui/pagination";
import { notificationService } from "@/services/notification-service";
import { NotificationListItem, PaginatedMeta } from "@/types";

const PAGE_SIZE = 15;

const EVENT_LABEL: Record<string, string> = {
  application_submitted: "New application submitted",
  submission_confirmation: "Submission confirmation sent",
  status_change: "Application status changed",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminNotificationsPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  function load() {
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);

    notificationService
      .list(page, PAGE_SIZE)
      .then(({ notifications, meta }) => {
        if (cancelled) return;
        setItems(notifications);
        setMeta(meta);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }

  useEffect(load, [page]);

  async function handleMarkRead(id: string) {
    setMarkingId(id);
    try {
      await notificationService.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, status: "read", read_at: new Date().toISOString() } : n)));
    } catch {
      // leave state as-is; user can retry
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
        <p className="mt-1 text-sm text-muted">Activity on your requisitions and applications.</p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-token ring-1 ring-border">
        {loadFailed && <p className="p-6 text-sm text-red-700 dark:text-red-400">Couldn&apos;t load notifications. Please try again.</p>}

        {!loadFailed && isLoading && (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-shimmer" />
            ))}
          </div>
        )}

        {!loadFailed && !isLoading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Bell className="h-8 w-8 text-muted/50" />
            <p className="text-sm text-muted">You&apos;re all caught up — no notifications yet.</p>
          </div>
        )}

        {!loadFailed && !isLoading && items.length > 0 && (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const isUnread = n.status !== "read";
              return (
                <li key={n.id} className={`flex items-start gap-3 px-4 py-4 sm:px-6 ${isUnread ? "bg-primary-soft/60" : ""}`}>
                  <span className="mt-1.5">
                    {isUnread ? (
                      <Circle className="h-2 w-2 fill-primary text-primary" />
                    ) : (
                      <span className="block h-2 w-2" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {n.subject || EVENT_LABEL[n.event] || n.event}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(n.created_at)}</p>
                  </div>
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      disabled={markingId === n.id}
                      className="shrink-0 text-xs font-medium text-primary hover:text-primary disabled:opacity-50"
                    >
                      Mark as read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {meta && !isLoading && (
          <div className="px-4 pb-4">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
