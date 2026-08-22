import { Briefcase, MapPin, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { JobListItem } from "@/types";

export function JobCard({ job }: { job: JobListItem }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-token transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-border-strong hover:shadow-token-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
          {job.title}
        </h3>
        <Badge tone="brand">{job.employment_type}</Badge>
      </div>

      <p className="text-sm text-muted">{job.department}</p>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
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
    </Link>
  );
}
