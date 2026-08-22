"use client";

import { Briefcase, CheckCircle2, FileText, Sparkles, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/features/auth/auth-context";
import { dashboardService } from "@/services/dashboard-service";
import { DashboardStats } from "@/types";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    dashboardService
      .getStats()
      .then(setStats)
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Welcome back{user?.first_name ? `, ${user.first_name}` : ""}.</p>
      </div>

      {loadFailed && (
        <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
          Couldn&apos;t load dashboard stats. Please refresh the page.
        </p>
      )}

      {!loadFailed && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Published Jobs"
            value={stats?.published_jobs ?? 0}
            icon={CheckCircle2}
            tone="success"
            isLoading={isLoading}
          />
          <StatCard label="Draft Jobs" value={stats?.draft_jobs ?? 0} icon={FileText} tone="neutral" isLoading={isLoading} />
          <StatCard label="Closed Jobs" value={stats?.closed_jobs ?? 0} icon={XCircle} tone="warning" isLoading={isLoading} />
          <StatCard
            label="Total Applications"
            value={stats?.total_applications ?? 0}
            icon={Briefcase}
            tone="brand"
            isLoading={isLoading}
          />
          <StatCard
            label="New Applications"
            value={stats?.new_applications ?? 0}
            icon={Sparkles}
            tone="brand"
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
