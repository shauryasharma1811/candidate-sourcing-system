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
    neutral: "bg-gray-100 text-gray-600",
    brand: "bg-blue-100 text-blue-600",
    success: "bg-green-100 text-green-600",
    warning: "bg-amber-100 text-amber-600",
  };

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          {isLoading ? (
            <div className="mt-1 h-6 w-12 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}
