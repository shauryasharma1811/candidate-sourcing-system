"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SiteHeader } from "@/components/ui/site-header";
import { ProtectedRoute } from "@/features/auth/protected-route";
import { ApplicationHistoryTable } from "@/features/applications/application-history-table";
import { applicationService } from "@/services/application-service";
import { MyApplicationItem } from "@/types";

function MyApplicationsContent() {
  const [items, setItems] = useState<MyApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    applicationService
      .listMine()
      .then(setItems)
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-foreground">My Applications</h1>
        <p className="mt-1 text-sm text-muted">Your full application history — status, dates, and Application IDs.</p>

        <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-token ring-1 ring-border">
          {loadFailed && <p className="p-6 text-sm text-red-700 dark:text-red-400">Couldn&apos;t load your applications.</p>}

          {!loadFailed && isLoading && (
            <div className="space-y-2 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-shimmer" />
              ))}
            </div>
          )}

          {!loadFailed && !isLoading && items.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-muted">You haven&apos;t applied to any jobs yet.</p>
              <Link href="/jobs" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary">
                Browse open positions
              </Link>
            </div>
          )}

          {!loadFailed && !isLoading && items.length > 0 && <ApplicationHistoryTable items={items} />}
        </div>
      </div>
    </div>
  );
}

export default function MyApplicationsPage() {
  return (
    <ProtectedRoute allowedRoles={["Candidate"]}>
      <MyApplicationsContent />
    </ProtectedRoute>
  );
}

