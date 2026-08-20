import { PaginatedMeta } from "@/types";

export function Pagination({ meta, onPageChange }: { meta: PaginatedMeta; onPageChange: (page: number) => void }) {
  if (meta.total_pages <= 1) return null;

  const canPrev = meta.page > 1;
  const canNext = meta.page < meta.total_pages;
  const from = (meta.page - 1) * meta.page_size + 1;
  const to = Math.min(meta.page * meta.page_size, meta.total);

  return (
    <nav className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-4 sm:flex-row" aria-label="Pagination">
      <p className="text-sm text-gray-600">
        Showing <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of{" "}
        <span className="font-medium">{meta.total}</span> jobs
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={!canPrev}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">
          Page {meta.page} of {meta.total_pages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={!canNext}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
