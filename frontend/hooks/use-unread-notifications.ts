"use client";

import { useEffect, useState } from "react";

import { notificationService } from "@/services/notification-service";

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls the unread admin-notification count on an interval. Used by both
 * the bell badge and the sidebar's "Notifications" nav item so the two
 * numbers can never drift apart — each mount just gets its own poller.
 */
export function useUnreadNotificationCount(): [number, () => void] {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function refresh() {
      notificationService
        .unreadCount()
        .then(({ unread_count }) => {
          if (!cancelled) setUnreadCount(unread_count);
        })
        .catch(() => {
          // best-effort — count just stays at its last known value
        });
    }

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function decrementOptimistically() {
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return [unreadCount, decrementOptimistically];
}
