import { PaginatedMeta } from "@/types";

export function Pagination({
  meta,
  onPageChange,
  itemLabel = "items",
}: {
  meta: PaginatedMeta;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (meta.total_pages <= 1) return null;

  const canPrev = meta.page > 1;
  const canNext = meta.page < meta.total_pages;
  const from = (meta.page - 1) * meta.page_size + 1;
  const to = Math.min(meta.page * meta.page_size, meta.total);

  return (
    <nav
      className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{meta.total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={!canPrev}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-inset ring-border transition-all duration-200 hover:bg-surface-muted hover:ring-border-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Previous
        </button>
        <span className="text-sm text-muted">
          Page {meta.page} of {meta.total_pages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={!canNext}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-inset ring-border transition-all duration-200 hover:bg-surface-muted hover:ring-border-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
