"use client";

import {
  Briefcase,
  Calendar,
  ChevronLeft,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { ResumeLink } from "@/features/applications/resume-link";
import { StatusSelect } from "@/features/applications/status-select";
import { ApiRequestError } from "@/lib/api-client";
import { applicationService } from "@/services/application-service";
import { ApplicationDetail, ApplicationStatus } from "@/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string | null, currentlyWorking: boolean): string {
  const startDate = new Date(start);
  const endDate = currentlyWorking || !end ? new Date() : new Date(end);
  const months = Math.max(
    0,
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth())
  );
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} mo${remMonths === 1 ? "" : "s"}`;
  if (remMonths === 0) return `${years} yr${years === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"} ${remMonths} mo${remMonths === 1 ? "" : "s"}`;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-token ring-1 ring-border">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function CandidateProfilePage() {
  const params = useParams<{ applicationId: string }>();
  const applicationId = params.applicationId;

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    applicationService
      .getAdminDetail(applicationId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiRequestError ? err.message : "Couldn't load this application.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  function handleStatusUpdated(_applicationId: string, newStatus: ApplicationStatus) {
    setDetail((current) => (current ? { ...current, status: newStatus } : current));
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/applications"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Applications
      </Link>

      {isLoading && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-shimmer" />
          ))}
        </div>
      )}

      {!isLoading && loadError && (
        <p className="mt-6 rounded-2xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400 ring-1 ring-red-500/20">{loadError}</p>
      )}

      {!isLoading && detail && (
        <>
          {/* --- Header --- */}
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {detail.bio.first_name} {detail.bio.last_name}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Applying for <span className="font-medium text-foreground">{detail.job.title}</span> (
                {detail.job.requisition_code})
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted">{detail.application_code}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusSelect applicationId={detail.id} status={detail.status} onUpdated={handleStatusUpdated} />
              <p className="text-xs text-muted">Applied {formatDate(detail.applied_at)}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* --- Main column --- */}
            <div className="space-y-5 lg:col-span-2">
              {/* Bio */}
              <Section icon={UserIcon} title="Bio">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2 text-sm">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <div>
                      <dt className="text-xs text-muted">Email</dt>
                      <dd className="text-foreground">{detail.bio.email}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <div>
                      <dt className="text-xs text-muted">Mobile</dt>
                      <dd className="text-foreground">{detail.bio.mobile}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <div>
                      <dt className="text-xs text-muted">Location</dt>
                      <dd className="text-foreground">{detail.bio.location ?? "—"}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <div>
                      <dt className="text-xs text-muted">Date of Birth</dt>
                      <dd className="text-foreground">{formatDate(detail.bio.dob)}</dd>
                    </div>
                  </div>
                  <div className="text-sm">
                    <dt className="text-xs text-muted">Gender</dt>
                    <dd className="text-foreground">{detail.bio.gender ?? "—"}</dd>
                  </div>
                  <div className="text-sm">
                    <dt className="text-xs text-muted">Current Company</dt>
                    <dd className="text-foreground">{detail.bio.current_company ?? "—"}</dd>
                  </div>
                  <div className="text-sm">
                    <dt className="text-xs text-muted">Notice Period</dt>
                    <dd className="text-foreground">{detail.bio.notice_period ?? "—"}</dd>
                  </div>
                  <div className="text-sm">
                    <dt className="text-xs text-muted">Experience</dt>
                    <dd className="text-foreground">{detail.experience_summary}</dd>
                  </div>
                  {detail.bio.address && (
                    <div className="text-sm sm:col-span-2">
                      <dt className="text-xs text-muted">Address</dt>
                      <dd className="text-foreground">{detail.bio.address}</dd>
                    </div>
                  )}
                </dl>
              </Section>

              {/* Education */}
              <Section icon={GraduationCap} title={`Education (${detail.education.length})`}>
                {detail.education.length === 0 ? (
                  <p className="text-sm text-muted">No entries on file.</p>
                ) : (
                  <ul className="space-y-3">
                    {detail.education.map((e) => (
                      <li key={e.id} className="rounded-2xl bg-background p-3 ring-1 ring-border">
                        <p className="text-sm font-medium text-foreground">{e.degree}</p>
                        <p className="text-sm text-muted">{e.institution}</p>
                        <p className="mt-1 text-xs text-muted">
                          Class of {e.passing_year} · CGPA {e.cgpa}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Experience */}
              <Section icon={Briefcase} title={detail.is_fresher ? "Experience" : `Experience (${detail.experience.length})`}>
                {detail.is_fresher ? (
                  <p className="text-sm text-muted">Fresher — no prior work experience.</p>
                ) : detail.experience.length === 0 ? (
                  <p className="text-sm text-muted">No entries on file.</p>
                ) : (
                  <ul className="space-y-3">
                    {detail.experience.map((e) => (
                      <li key={e.id} className="rounded-2xl bg-background p-3 ring-1 ring-border">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {e.title} · {e.company}
                          </p>
                          <p className="text-xs text-muted">
                            {formatDuration(e.start_date, e.end_date, e.currently_working)}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(e.start_date)} – {e.currently_working ? "Present" : formatDate(e.end_date)}
                        </p>
                        {e.responsibilities && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{e.responsibilities}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Cover note */}
              <Section icon={MessageSquare} title="Cover Note">
                {detail.cover_note ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{detail.cover_note}</p>
                ) : (
                  <p className="text-sm text-muted">No cover note submitted.</p>
                )}
              </Section>
            </div>

            {/* --- Side column --- */}
            <div className="space-y-5">
              {/* Resume preview */}
              <Section icon={FileText} title="Resume">
                {detail.resume ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{detail.resume.original_name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {(detail.resume.size_bytes / (1024 * 1024)).toFixed(2)} MB · Uploaded{" "}
                      {formatDate(detail.resume.uploaded_at)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Security scan:{" "}
                      <span
                        className={
                          detail.resume.scan_status === "clean"
                            ? "font-medium text-green-700 dark:text-green-400"
                            : detail.resume.scan_status === "pending"
                              ? "font-medium text-amber-700 dark:text-amber-400"
                              : "font-medium text-red-700 dark:text-red-400"
                        }
                      >
                        {detail.resume.scan_status}
                      </span>
                    </p>
                    <div className="mt-3">
                      <ResumeLink applicationId={detail.id} resume={detail.resume} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-red-700 dark:text-red-400">No resume on file.</p>
                )}
              </Section>

              {/* Status */}
              <Section icon={Calendar} title="Status">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Current status</span>
                  <StatusBadge status={detail.status} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  <p>Applied {formatDateTime(detail.applied_at)}</p>
                  {detail.reviewed_at && (
                    <p>
                      Reviewed {formatDateTime(detail.reviewed_at)}
                      {detail.reviewed_by_admin_name ? ` by ${detail.reviewed_by_admin_name}` : ""}
                    </p>
                  )}
                </div>
              </Section>

              {/* Timeline */}
              <Section icon={Calendar} title="Timeline">
                {detail.timeline.length === 0 ? (
                  <p className="text-sm text-muted">No activity recorded yet.</p>
                ) : (
                  <ol className="relative space-y-4 border-l border-border pl-4">
                    {detail.timeline.map((event, i) => (
                      <li key={`${event.event}-${i}`} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-surface" />
                        <p className="text-sm font-medium text-foreground">{event.label}</p>
                        <p className="text-xs text-muted">
                          {formatDateTime(event.at)}
                          {event.actor ? ` · ${event.actor}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
