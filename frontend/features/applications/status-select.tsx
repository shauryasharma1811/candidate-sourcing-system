"use client";

import { useState } from "react";

import { applicationService } from "@/services/application-service";
import { ApplicationStatus } from "@/types";

const STATUS_OPTIONS: ApplicationStatus[] = ["New", "Reviewed", "Shortlisted", "Rejected"];

const TONE_BY_STATUS: Record<ApplicationStatus, string> = {
  New: "border-blue-200 bg-primary-soft text-primary",
  Reviewed: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Shortlisted: "border-purple-200 bg-purple-50 text-purple-700",
  Rejected: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
};

export function StatusSelect({
  applicationId,
  status,
  onUpdated,
}: {
  applicationId: string;
  status: ApplicationStatus;
  onUpdated: (applicationId: string, newStatus: ApplicationStatus) => void;
}) {
  const [current, setCurrent] = useState(status);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: ApplicationStatus) {
    if (next === current) return;
    const previous = current;
    setCurrent(next); // optimistic — the grid should feel instant
    setError(null);
    setIsSaving(true);
    try {
      await applicationService.updateStatus(applicationId, next);
      onUpdated(applicationId, next);
    } catch {
      setCurrent(previous); // roll back on failure
      setError("Couldn't update status");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <select
        value={current}
        disabled={isSaving}
        onChange={(e) => handleChange(e.target.value as ApplicationStatus)}
        aria-label="Update application status"
        className={`rounded-2xl border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-wait disabled:opacity-70 ${TONE_BY_STATUS[current]}`}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
