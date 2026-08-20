"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { JobCard } from "@/components/ui/job-card";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { SiteHeader } from "@/components/ui/site-header";
import { jobService } from "@/services/job-service";
import { JobFilters, JobListItem, PaginatedMeta } from "@/types";

const ANY = ""; // sentinel for "no filter selected"
const PAGE_SIZE = 9;

function JobsListingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1") || 1;
  const q = searchParams.get("q") ?? "";
  const department = searchParams.get("department") ?? ANY;
  const location = searchParams.get("location") ?? ANY;
  const experience = searchParams.get("experience") ?? ANY;

  const [searchInput, setSearchInput] = useState(q);
  const [filters, setFilters] = useState<JobFilters | null>(null);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Filter facets (departments/locations/experience) load once — they're
  // backend-derived from Published jobs so they never go stale for long.
  useEffect(() => {
    jobService
      .getFilters()
      .then(setFilters)
      .catch(() => setFilters({ departments: [], locations: [], experience_levels: [], employment_types: [] }));
  }, []);

  // Re-fetch the job list whenever any URL param changes — this is what
  // makes a filtered/searched view a shareable link.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);

    jobService
      .listPublic({
        page,
        pageSize: PAGE_SIZE,
        q: q || undefined,
        department: department || undefined,
        location: location || undefined,
        experience: experience || undefined,
      })
      .then(({ jobs, meta }) => {
        if (cancelled) return;
        setJobs(jobs);
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
  }, [page, q, department, location, experience]);

  useEffect(() => setSearchInput(q), [q]);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    if (!("page" in next)) params.delete("page"); // any filter change resets to page 1
    router.push(`/jobs?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: searchInput.trim() });
  }

  const activeFilterCount = useMemo(
    () => [department, location, experience].filter(Boolean).length,
    [department, location, experience]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Open Positions</h1>
        <p className="mt-1 text-sm text-gray-600">Browse and search — no account required.</p>

        <form onSubmit={handleSearchSubmit} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search job titles…"
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Search job titles"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Department"
            value={department}
            onChange={(e) => updateParams({ department: e.target.value })}
          >
            <option value={ANY}>All departments</option>
            {filters?.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>

          <Select label="Location" value={location} onChange={(e) => updateParams({ location: e.target.value })}>
            <option value={ANY}>All locations</option>
            {filters?.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>

          <Select
            label="Experience"
            value={experience}
            onChange={(e) => updateParams({ experience: e.target.value })}
          >
            <option value={ANY}>Any experience</option>
            {filters?.experience_levels.map((exp) => (
              <option key={exp} value={exp}>
                {exp}
              </option>
            ))}
          </Select>
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => updateParams({ department: "", location: "", experience: "" })}
            className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
          </button>
        )}

        <div className="mt-8">
          {loadFailed && (
            <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              Something went wrong loading jobs. Please try again.
            </p>
          )}

          {!loadFailed && isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-lg bg-gray-200" />
              ))}
            </div>
          )}

          {!loadFailed && !isLoading && jobs.length === 0 && (
            <p className="rounded-md bg-white p-8 text-center text-sm text-gray-500 ring-1 ring-gray-200">
              No jobs match your search. Try adjusting your filters.
            </p>
          )}

          {!loadFailed && !isLoading && jobs.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}

          {meta && !isLoading && <Pagination meta={meta} onPageChange={(p) => updateParams({ page: String(p) })} />}
        </div>
      </div>
    </div>
  );
}

export default function JobsListingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading jobs…</div>}>
      <JobsListingContent />
    </Suspense>
  );
}
