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
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Build what&apos;s next, with us
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Explore open roles across every team. No account needed to browse — apply when you find the right fit.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Search className="h-4 w-4" />
              Browse Open Roles
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Featured Openings</h2>
          <Link href="/jobs" className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            View all jobs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadFailed && (
          <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
            We couldn&apos;t load featured jobs right now. Try browsing all open roles instead.
          </p>
        )}

        {!loadFailed && featuredJobs.length === 0 && (
          <p className="text-sm text-gray-500">No open positions right now — check back soon.</p>
        )}

        {featuredJobs.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
