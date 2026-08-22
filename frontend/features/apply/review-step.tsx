"use client";

import { CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api-client";
import { applicationService } from "@/services/application-service";
import { ApplicationProgress, ApplicationSubmitResult } from "@/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ReviewStep({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const [progress, setProgress] = useState<ApplicationProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplicationSubmitResult | null>(null);

  useEffect(() => {
    applicationService
      .getProgress(jobId)
      .then(setProgress)
      .catch(() => setLoadError("Couldn't load your application. Please try again."))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  async function handleSubmit() {
    if (!consent) {
      setSubmitError("Please provide consent before submitting.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const submitted = await applicationService.submit(jobId, true, coverNote);
      setResult(submitted);
    } catch (err) {
      setSubmitError(err instanceof ApiRequestError ? err.message : "Couldn't submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Confirmation ---
  if (result) {
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600 dark:text-green-400" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">Application Submitted</h2>
        <p className="mt-2 text-sm text-muted">
          {progress && (
            <>
              Your application for <span className="font-medium text-foreground">{progress.job.title}</span> has been
              received.
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted">Submitted {formatDate(result.applied_at)}</p>

        <div className="mx-auto mt-4 inline-block rounded-2xl bg-background px-4 py-2 ring-1 ring-border">
          <p className="text-xs text-muted">Application ID</p>
          <p className="font-mono text-sm font-semibold text-foreground">{result.application_code}</p>
        </div>
        <p className="mt-2 text-xs text-muted">A confirmation email is on its way to you.</p>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/jobs">
            <Button type="button" variant="secondary">
              Browse more jobs
            </Button>
          </Link>
          <Link href="/applications/mine">
            <Button type="button">View my applications</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (loadError || !progress) return <p className="text-sm text-red-700 dark:text-red-400">{loadError ?? "Something went wrong."}</p>;

  if (progress.already_applied) {
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600 dark:text-green-400" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">You&apos;ve already applied</h2>
        <p className="mt-2 text-sm text-muted">
          Your application for <span className="font-medium text-foreground">{progress.job.title}</span> is currently{" "}
          <span className="font-medium text-foreground">{progress.application_status}</span>.
        </p>
        <div className="mt-6">
          <Link href="/applications/mine">
            <Button type="button">View my applications</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Review & Submit</h2>
      <p className="mt-1 text-sm text-muted">
        Applying for <span className="font-medium text-foreground">{progress.job.title}</span> ({progress.job.requisition_code})
      </p>

      <div className="mt-6 space-y-4">
        <section className="rounded-2xl bg-background p-4 ring-1 ring-border">
          <h3 className="text-sm font-semibold text-foreground">Bio Data</h3>
          <p className="mt-1 text-sm text-muted">
            {progress.bio.first_name} {progress.bio.last_name} · {progress.bio.mobile}
            {progress.bio.location ? ` · ${progress.bio.location}` : ""}
          </p>
          <p className="text-sm text-muted">{progress.bio.email}</p>
        </section>

        <section className="rounded-2xl bg-background p-4 ring-1 ring-border">
          <h3 className="text-sm font-semibold text-foreground">Education ({progress.education.length})</h3>
          <ul className="mt-1 space-y-1">
            {progress.education.map((e) => (
              <li key={e.id} className="text-sm text-muted">
                {e.degree}, {e.institution} — {e.passing_year} (CGPA {e.cgpa})
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-background p-4 ring-1 ring-border">
          <h3 className="text-sm font-semibold text-foreground">Work Experience {progress.is_fresher ? "" : `(${progress.experience.length})`}</h3>
          {progress.is_fresher ? (
            <p className="mt-1 text-sm text-muted">Fresher — no prior work experience.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {progress.experience.map((e) => (
                <li key={e.id} className="text-sm text-muted">
                  {e.title} at {e.company}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-background p-4 ring-1 ring-border">
          <h3 className="text-sm font-semibold text-foreground">Resume</h3>
          {progress.resume ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <FileText className="h-4 w-4 text-muted" />
              {progress.resume.original_name}
            </p>
          ) : (
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">No resume uploaded.</p>
          )}
        </section>
      </div>

      <div className="mt-4">
        <label htmlFor="cover-note" className="text-sm font-medium text-foreground">
          Cover note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="cover-note"
          value={coverNote}
          onChange={(e) => setCoverNote(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Anything you'd like the hiring team to know…"
          className="mt-1 w-full rounded-2xl border border-border p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-right text-xs text-muted">{coverNote.length}/2000</p>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-2xl border border-border p-4 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-foreground">
          I confirm the information above is accurate and I consent to it being shared with the hiring team for this
          role.
        </span>
      </label>

      {submitError && (
        <div className="mt-4 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400 ring-1 ring-red-500/20">{submitError}</div>
      )}

      <div className="mt-6 flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={submitting || !consent}>
          {submitting ? "Submitting…" : "Submit Application"}
        </Button>
      </div>
    </div>
  );
}
