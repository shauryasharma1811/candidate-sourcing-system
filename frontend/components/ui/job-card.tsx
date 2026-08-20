import { Briefcase, MapPin, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { JobListItem } from "@/types";

export function JobCard({ job }: { job: JobListItem }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{job.title}</h3>
        <Badge tone="brand">{job.employment_type}</Badge>
      </div>

      <p className="text-sm text-gray-500">{job.department}</p>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <MapPin className="h-4 w-4 text-gray-400" />
          {job.location}
        </span>
        {job.experience_required && (
          <span className="flex items-center gap-1">
            <Briefcase className="h-4 w-4 text-gray-400" />
            {job.experience_required}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="h-4 w-4 text-gray-400" />
          {job.openings} opening{job.openings === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}
