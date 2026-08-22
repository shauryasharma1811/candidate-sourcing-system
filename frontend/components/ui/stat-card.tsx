import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  isLoading = false,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "neutral" | "brand" | "success" | "warning";
  isLoading?: boolean;
}) {
  const toneClass: Record<string, string> = {
    neutral: "bg-surface-muted text-muted",
    brand: "bg-primary-soft text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-token transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-token-md">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          {isLoading ? (
            <div className="mt-1.5 h-6 w-12 animate-pulse rounded-md bg-shimmer" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}
