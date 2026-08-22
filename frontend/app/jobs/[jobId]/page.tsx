"use client";

import { Briefcase, Building2, Calendar, Hash, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichTextSection } from "@/components/ui/rich-text-section";
import { ShareButton } from "@/components/ui/share-button";
import { SiteHeader } from "@/components/ui/site-header";
import { jobService } from "@/services/job-service";
import { JobDetail } from "@/types";

function formatPostedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function JobDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="h-8 w-2/3 animate-pulse rounded bg-shimmer" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-shimmer" />
        <div className="h-40 animate-pulse rounded-2xl bg-shimmer" />
        <div className="h-40 animate-pulse rounded-2xl bg-shimmer" />
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-shimmer lg:col-span-1" />
    </div>
  );
}

function QuickFacts({ job }: { job: JobDetail }) {
  const facts = [
    { icon: Building2, label: "Department", value: job.department },
    { icon: MapPin, label: "Location", value: job.location },
    { icon: Briefcase, label: "Experience", value: job.experience_required ?? "Not specified" },
    { icon: Users, label: "Openings", value: `${job.openings} opening${job.openings === 1 ? "" : "s"}` },
    { icon: Calendar, label: "Posted", value: formatPostedDate(job.created_at) },
    { icon: Hash, label: "Requisition ID", value: job.requisition_code },
  ];

  return (
    <dl className="space-y-3">
      {facts.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
            <dd className="text-sm text-foreground">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function JobDetailContent({ job }: { job: JobDetail }) {
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <>
      {/* Overview */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="rounded-2xl bg-surface p-6 shadow-token ring-1 ring-border sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{job.title}</h1>
                <p className="mt-1 text-sm text-muted">{job.department}</p>
              </div>
              <Badge tone="brand">{job.employment_type}</Badge>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-muted" />
                {job.location}
              </span>
              {job.experience_required && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4 text-muted" />
                  {job.experience_required}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4 text-muted" />
                {job.openings} opening{job.openings === 1 ? "" : "s"}
              </span>
            </div>

            {/* Quick facts + CTAs — visible on mobile only, right below the overview.
                On desktop these live in the sticky sidebar instead. */}
            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6 lg:hidden">
              <QuickFacts job={job} />
              <div className="mt-2 flex gap-3">
                <Link href={`/jobs/${job.id}/apply`} className="flex-1">
                  <Button type="button" className="w-full">
                    Apply Now
                  </Button>
                </Link>
                <ShareButton title={job.title} url={shareUrl} />
              </div>
            </div>
          </div>

          {job.description && (
            <section className="rounded-2xl bg-surface p-6 shadow-token ring-1 ring-border sm:p-8">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Description</h2>
              <RichTextSection text={job.description} />
            </section>
          )}

          {job.requirements && (
            <section className="rounded-2xl bg-surface p-6 shadow-token ring-1 ring-border sm:p-8">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Requirements</h2>
              <RichTextSection text={job.requirements} />
            </section>
          )}
        </div>

        {/* Sticky sidebar — desktop only */}
        <aside className="hidden lg:col-span-1 lg:block">
          <div className="sticky top-24 space-y-6 rounded-2xl bg-surface p-6 shadow-token ring-1 ring-border">
            <QuickFacts job={job} />
            <div className="space-y-3 border-t border-border pt-5">
              <Link href={`/jobs/${job.id}/apply`}>
                <Button type="button" className="w-full">
                  Apply Now
                </Button>
              </Link>
              <ShareButton title={job.title} url={shareUrl} />
            </div>
          </div>
        </aside>
      </div>

      {/* Fixed bottom CTA bar — mobile only, keeps Apply reachable while scrolling */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-border bg-surface p-4 shadow-[0_-1px_4px_rgba(0,0,0,0.05)] lg:hidden">
        <Link href={`/jobs/${job.id}/apply`} className="flex-1">
          <Button type="button" className="w-full">
            Apply Now
          </Button>
        </Link>
        <ShareButton title={job.title} url={shareUrl} />
      </div>
    </>
  );
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    jobService
      .getById(jobId)
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* pb-24 reserves room for the fixed mobile CTA bar so it never covers content */}
      <div className="mx-auto max-w-6xl px-4 py-10 pb-24 sm:px-6 lg:px-8 lg:pb-10">
        <Link href="/jobs" className="text-sm font-medium text-primary hover:text-primary">
          ← Back to all jobs
        </Link>

        <div className="mt-6">
          {isLoading && <JobDetailSkeleton />}

          {!isLoading && notFound && (
            <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-border">
              <p className="text-foreground">This job posting isn&apos;t available.</p>
              <p className="mt-1 text-sm text-muted">It may have closed or the link may be incorrect.</p>
            </div>
          )}

          {!isLoading && job && <JobDetailContent job={job} />}
        </div>
      </div>
    </div>
  );
}
