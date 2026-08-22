"use client";

/**
 * BRD: candidate application-history view. One dataset, two renderings —
 * a real <table> from `sm` up, and stacked cards below it — so the same
 * six data points (Application ID, Job, Status, Date, Job details link)
 * stay readable at any width instead of forcing horizontal scroll on a
 * phone.
 */
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { MyApplicationItem } from "@/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ApplicationHistoryTable({ items }: { items: MyApplicationItem[] }) {
  return (
    <>
      {/* Desktop / tablet: real table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-background">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted sm:px-6">Application ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted sm:px-6">Job</th>
              <th className="px-4 py-3 text-left font-medium text-muted sm:px-6">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted sm:px-6">Applied On</th>
              <th className="px-4 py-3 text-right font-medium text-muted sm:px-6">
                <span className="sr-only">Job details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-background">
                <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-muted sm:px-6">
                  {item.application_code}
                </td>
                <td className="px-4 py-4 font-medium text-foreground sm:px-6">{item.job_title}</td>
                <td className="px-4 py-4 sm:px-6">
                  <StatusBadge status={item.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-6">{formatDate(item.applied_at)}</td>
                <td className="px-4 py-4 text-right sm:px-6">
                  <Link
                    href={`/jobs/${item.job_id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary"
                  >
                    Job details
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards — same fields, no horizontal scroll */}
      <ul className="divide-y divide-border sm:hidden">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.job_title}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">{item.application_code}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted">Applied {formatDate(item.applied_at)}</p>
              <Link
                href={`/jobs/${item.job_id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary"
              >
                Job details
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
