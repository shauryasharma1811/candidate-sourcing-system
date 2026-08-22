"use client";

import { FileText, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { applicationService } from "@/services/application-service";
import { ResumeMetadata } from "@/types";

export function ResumeLink({ applicationId, resume }: { applicationId: string; resume: ResumeMetadata | null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!resume) {
    return <span className="text-xs text-muted">No resume</span>;
  }

  // Secure downloads: mirror the backend's gate on the client so the
  // button itself communicates why a download isn't available, rather
  // than only surfacing it as a failed request after the click.
  if (resume.scan_status !== "clean") {
    const isInfected = resume.scan_status === "infected";
    return (
      <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        {isInfected ? "Failed security scan" : resume.scan_status === "failed" ? "Scan failed" : "Scan pending"}
      </div>
    );
  }

  async function handleClick() {
    setError(null);
    setIsLoading(true);
    try {
      const { url } = await applicationService.getResumeDownloadLink(applicationId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open resume");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        title="Passed virus scan"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary disabled:cursor-wait disabled:opacity-60"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {resume.original_name}
        <ShieldCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      </button>
      {error && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
