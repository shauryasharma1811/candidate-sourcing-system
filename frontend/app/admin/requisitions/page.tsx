"use client";

import { Copy, Pencil, Plus, Search, Send, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiRequestError } from "@/lib/api-client";
import { requisitionService } from "@/services/requisition-service";
import { JobStatus, PaginatedMeta, RequisitionListItem } from "@/types";

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminRequisitionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<RequisitionListItem[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Row-action state — which requisition is mid-action, and any error to surface.
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RequisitionListItem | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);

    requisitionService
      .list({ page, pageSize: PAGE_SIZE, status, q: q || undefined })
      .then(({ requisitions, meta }) => {
        if (cancelled) return;
        setItems(requisitions);
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
  }, [page, status, q, refreshTick]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  }

  function refresh() {
    setRefreshTick((t) => t + 1);
  }

  async function handlePublish(req: RequisitionListItem, e: React.MouseEvent) {
    e.stopPropagation();
    setActionError(null);
    setPendingActionId(req.id);
    try {
      await requisitionService.publish(req.id);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Couldn't publish this requisition.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleClose(req: RequisitionListItem, e: React.MouseEvent) {
    e.stopPropagation();
    setActionError(null);
    setPendingActionId(req.id);
    try {
      await requisitionService.close(req.id);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Couldn't close this requisition.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDuplicate(req: RequisitionListItem, e: React.MouseEvent) {
    e.stopPropagation();
    setActionError(null);
    setPendingActionId(req.id);
    try {
      const copy = await requisitionService.duplicate(req.id);
      router.push(`/admin/requisitions/${copy.id}/edit`);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Couldn't duplicate this requisition.");
      setPendingActionId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    setPendingActionId(deleteTarget.id);
    try {
      await requisitionService.remove(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Couldn't delete this requisition.");
      setDeleteTarget(null);
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Requisitions</h1>
          <p className="mt-1 text-sm text-muted">All job requisitions, across every status.</p>
        </div>
        <Link href="/admin/requisitions/new">
          <Button type="button">
            <Plus className="h-4 w-4" />
            New Requisition
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title…"
              className="w-full rounded-2xl border border-border py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Search requisitions by title"
            />
          </div>
          <button type="submit" className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            Search
          </button>
        </form>

        <div className="sm:w-48">
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as JobStatus | "");
            }}
          >
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Closed">Closed</option>
          </Select>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400 ring-1 ring-red-500/20">{actionError}</div>
      )}

      <div className="overflow-hidden rounded-2xl bg-surface shadow-token ring-1 ring-border">
        {loadFailed && <p className="p-6 text-sm text-red-700 dark:text-red-400">Couldn&apos;t load requisitions. Please try again.</p>}

        {!loadFailed && isLoading && (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-shimmer" />
            ))}
          </div>
        )}

        {!loadFailed && !isLoading && items.length === 0 && (
          <p className="p-8 text-center text-sm text-muted">No requisitions match your filters.</p>
        )}

        {!loadFailed && !isLoading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-background">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Openings</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Applications</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Created</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((req) => {
                  const isBusy = pendingActionId === req.id;
                  return (
                    <tr
                      key={req.id}
                      onClick={() => router.push(`/admin/requisitions/${req.id}/edit`)}
                      className="cursor-pointer hover:bg-background"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{req.title}</td>
                      <td className="px-4 py-3 text-muted">{req.department}</td>
                      <td className="px-4 py-3 text-muted">{req.location}</td>
                      <td className="px-4 py-3 text-muted">{req.openings}</td>
                      <td className="px-4 py-3 text-muted">{req.application_count}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDate(req.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit"
                            aria-label="Edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/requisitions/${req.id}/edit`);
                            }}
                            className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {req.status === "Draft" && (
                            <button
                              type="button"
                              title="Publish"
                              aria-label="Publish"
                              disabled={isBusy}
                              onClick={(e) => handlePublish(req, e)}
                              className="rounded p-1.5 text-muted hover:bg-green-500/10 hover:text-green-700 dark:hover:text-green-400 disabled:opacity-50"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          )}

                          {req.status === "Published" && (
                            <button
                              type="button"
                              title="Close"
                              aria-label="Close"
                              disabled={isBusy}
                              onClick={(e) => handleClose(req, e)}
                              className="rounded p-1.5 text-muted hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            title="Duplicate"
                            aria-label="Duplicate"
                            disabled={isBusy}
                            onClick={(e) => handleDuplicate(req, e)}
                            className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          {req.status === "Draft" && (
                            <button
                              type="button"
                              title="Delete"
                              aria-label="Delete"
                              disabled={isBusy}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionError(null);
                                setDeleteTarget(req);
                              }}
                              className="rounded p-1.5 text-muted hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && !isLoading && (
          <div className="px-4 pb-4">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this requisition?"
        description={deleteTarget ? `"${deleteTarget.title}" will be permanently deleted. This can't be undone.` : ""}
        confirmLabel="Delete"
        isConfirming={deleteTarget !== null && pendingActionId === deleteTarget.id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
