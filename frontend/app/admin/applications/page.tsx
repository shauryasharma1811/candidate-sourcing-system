"use client";

import { useEffect, useState } from "react";

import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { applicationService } from "@/services/application-service";
import { ApplicationListItem, ApplicationStatus, PaginatedMeta } from "@/types";

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminApplicationsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApplicationStatus | "">("");

  const [items, setItems] = useState<ApplicationListItem[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);

    applicationService
      .listAdmin({ page, pageSize: PAGE_SIZE, status })
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
  }, [page, status]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Applications</h1>
          <p className="mt-1 text-sm text-gray-600">Review candidate applications across every requisition.</p>
        </div>
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
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        {loadFailed && <p className="p-6 text-sm text-red-700">Couldn&apos;t load applications. Please try again.</p>}

        {!loadFailed && isLoading && (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        )}

        {!loadFailed && !isLoading && items.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">No applications match your filters.</p>
        )}

        {!loadFailed && !isLoading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Candidate</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Job</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{app.candidate_name}</div>
                      <div className="text-xs text-gray-500">{app.candidate_email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{app.job_title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(app.applied_at)}</td>
                  </tr>
                ))}
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
    </div>
  );
}
