const TONE_BY_STATUS: Record<string, string> = {
  // Job statuses
  Draft: "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300 dark:bg-slate-400/10 dark:ring-slate-400/20",
  Published:
    "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/15 dark:ring-emerald-500/25",
  Closed: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20 dark:text-red-400 dark:bg-red-500/15 dark:ring-red-500/25",
  // Application statuses
  New: "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-400 dark:bg-blue-500/15 dark:ring-blue-500/25",
  Reviewed: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20 dark:text-amber-400 dark:bg-amber-500/15 dark:ring-amber-500/25",
  Shortlisted:
    "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-400 dark:bg-violet-500/15 dark:ring-violet-500/25",
  Rejected: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20 dark:text-red-400 dark:bg-red-500/15 dark:ring-red-500/25",
};

export function StatusBadge({ status }: { status: string }) {
  const toneClass =
    TONE_BY_STATUS[status] ??
    "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300 dark:bg-slate-400/10 dark:ring-slate-400/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors duration-200 ${toneClass}`}
    >
      {status}
    </span>
  );
}
