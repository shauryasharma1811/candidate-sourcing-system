const TONE_BY_STATUS: Record<string, string> = {
  // Job statuses
  Draft: "bg-gray-100 text-gray-700 ring-gray-200",
  Published: "bg-green-50 text-green-700 ring-green-200",
  Closed: "bg-red-50 text-red-700 ring-red-200",
  // Application statuses
  New: "bg-blue-50 text-blue-700 ring-blue-200",
  Reviewed: "bg-amber-50 text-amber-700 ring-amber-200",
  Shortlisted: "bg-purple-50 text-purple-700 ring-purple-200",
  Rejected: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  const toneClass = TONE_BY_STATUS[status] ?? "bg-gray-100 text-gray-700 ring-gray-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass}`}>
      {status}
    </span>
  );
}
