import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

import { JobCard } from "@/components/ui/job-card";
import { SiteHeader } from "@/components/ui/site-header";
import { jobService } from "@/services/job-service";

export default async function HomePage() {
  let featuredJobs: Awaited<ReturnType<typeof jobService.listPublic>>["jobs"] = [];
  let loadFailed = false;

  try {
    const { jobs } = await jobService.listPublic({ page: 1, pageSize: 3 });
    featuredJobs = jobs;
  } catch {
    loadFailed = true;
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden bg-surface">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] opacity-60"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 0%, hsl(var(--primary) / 0.14), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <span className="inline-flex animate-fade-in-up items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
            We&apos;re hiring across every team
          </span>
          <h1 className="mt-4 animate-fade-in-up text-3xl font-bold tracking-tight text-foreground [animation-delay:60ms] sm:text-5xl">
            Build what&apos;s next, with us
          </h1>
          <p className="mx-auto mt-4 max-w-2xl animate-fade-in-up text-base text-muted [animation-delay:120ms] sm:text-lg">
            Explore open roles across every team. No account needed to browse — apply when you find the right fit.
          </p>
          <div className="mt-8 flex animate-fade-in-up justify-center [animation-delay:180ms]">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-token transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-token-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Search className="h-4 w-4" />
              Browse Open Roles
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Featured Openings</h2>
          <Link
            href="/jobs"
            className="flex items-center gap-1 text-sm font-medium text-primary transition-opacity duration-200 hover:opacity-75"
          >
            View all jobs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadFailed && (
          <p className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300 dark:text-amber-300">
            We couldn&apos;t load featured jobs right now. Try browsing all open roles instead.
          </p>
        )}

        {!loadFailed && featuredJobs.length === 0 && (
          <p className="text-sm text-muted">No open positions right now — check back soon.</p>
        )}

        {featuredJobs.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredJobs.map((job, i) => (
              <div key={job.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
