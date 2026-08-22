"use client";

import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResumeLink } from "@/features/applications/resume-link";
import { StatusSelect } from "@/features/applications/status-select";
import { applicationService } from "@/services/application-service";
import { requisitionService } from "@/services/requisition-service";
import { ApplicationListItem, ApplicationStatus, PaginatedMeta, RequisitionListItem } from "@/types";

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminApplicationsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [jobId, setJobId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [items, setItems] = useState<ApplicationListItem[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [jobs, setJobs] = useState<RequisitionListItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Job filter options — every requisition (not just Published), so a
  // recruiter can pull up a Closed requisition's application history too.
  useEffect(() => {
    requisitionService
      .list({ pageSize: 100 })
      .then(({ requisitions }) => setJobs(requisitions))
      .catch(() => setJobs([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);

    applicationService
      .listAdmin({ page, pageSize: PAGE_SIZE, status, jobId: jobId || undefined, search: search || undefined })
      .then(({ applications, meta }) => {
        if (cancelled) return;
        setItems(applications);
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
  }, [page, status, jobId, search]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleStatusUpdated(applicationId: string, newStatus: ApplicationStatus) {
    setItems((current) => current.map((item) => (item.id === applicationId ? { ...item, status: newStatus } : item)));
  }

  async function handleExport(format: "csv" | "xlsx") {
    setExportError(null);
    setIsExporting(true);
    try {
      await applicationService.exportApplications(format, {
        status,
        jobId: jobId || undefined,
        search: search || undefined,
      });
    } catch {
      setExportError("Couldn't export applications. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Applications</h1>
          <p className="mt-1 text-sm text-muted">Review candidate applications across every requisition.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-2xl bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-inset ring-border hover:bg-background disabled:cursor-wait disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-2xl bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-inset ring-border hover:bg-background disabled:cursor-wait disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting…" : "Export Excel"}
            </button>
          </div>
          {exportError && <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form onSubmit={handleSearchSubmit} className="min-w-[220px] flex-1">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Candidate name or email…"
                className="w-full rounded-2xl border border-border py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Search by candidate name or email"
              />
            </div>
          </label>
        </form>

        <div className="w-48">
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as ApplicationStatus | "");
            }}
          >
            <option value="">All statuses</option>
            <option value="New">New</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Rejected">Rejected</option>
          </Select>
        </div>

        <div className="w-64">
          <Select
            label="Requisition"
            value={jobId}
            onChange={(e) => {
              setPage(1);
              setJobId(e.target.value);
            }}
          >
            <option value="">All requisitions</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} ({job.requisition_code})
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-token ring-1 ring-border">
        {loadFailed && <p className="p-6 text-sm text-red-700 dark:text-red-400">Couldn&apos;t load applications. Please try again.</p>}

        {!loadFailed && isLoading && (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-shimmer" />
            ))}
          </div>
        )}

        {!loadFailed && !isLoading && items.length === 0 && (
          <p className="p-8 text-center text-sm text-muted">No applications match your filters.</p>
        )}

        {!loadFailed && !isLoading && items.length > 0 && (
          <>
            {/* Desktop / tablet: real table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-background">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted">Application ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Candidate</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Job</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Applied On</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Experience</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Resume</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((app) => (
                    <tr key={app.id} className="hover:bg-background">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{app.application_code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{app.candidate_name}</div>
                        <div className="text-xs text-muted">{app.candidate_email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted">{app.job_title}</td>
                      <td className="px-4 py-3 text-muted">{formatDate(app.applied_at)}</td>
                      <td className="px-4 py-3 text-muted">{app.experience_summary}</td>
                      <td className="px-4 py-3 text-muted">{app.candidate_location ?? "—"}</td>
                      <td className="px-4 py-3">
                        <ResumeLink applicationId={app.id} resume={app.resume} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusSelect applicationId={app.id} status={app.status} onUpdated={handleStatusUpdated} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/applications/${app.id}`}
                          className="text-sm font-medium text-primary hover:text-primary"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet: stacked cards */}
            <ul className="divide-y divide-border lg:hidden">
              {items.map((app) => (
                <li key={app.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{app.candidate_name}</p>
                      <p className="truncate text-xs text-muted">{app.candidate_email}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted">{app.application_code}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                    <div>
                      <dt className="text-muted">Job</dt>
                      <dd>{app.job_title}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Applied On</dt>
                      <dd>{formatDate(app.applied_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Experience</dt>
                      <dd>{app.experience_summary}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Location</dt>
                      <dd>{app.candidate_location ?? "—"}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <ResumeLink applicationId={app.id} resume={app.resume} />
                    <Link href={`/admin/applications/${app.id}`} className="text-sm font-medium text-primary hover:text-primary">
                      View
                    </Link>
                  </div>

                  <div className="mt-3">
                    <StatusSelect applicationId={app.id} status={app.status} onUpdated={handleStatusUpdated} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {meta && !isLoading && (
          <div className="px-4 pb-4">
            <Pagination meta={meta} onPageChange={setPage} itemLabel="applications" />
          </div>
        )}
      </div>
    </div>
  );
}
