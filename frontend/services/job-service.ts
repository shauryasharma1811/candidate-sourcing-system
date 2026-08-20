import { apiFetch, apiFetchWithMeta } from "@/lib/api-client";
import { JobDetail, JobFilters, JobListItem, PaginatedMeta } from "@/types";

export interface JobListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  department?: string;
  location?: string;
  experience?: string;
}

function buildQuery(params: JobListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.q) search.set("q", params.q);
  if (params.department) search.set("department", params.department);
  if (params.location) search.set("location", params.location);
  if (params.experience) search.set("experience", params.experience);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const jobService = {
  listPublic: (params: JobListParams = {}): Promise<{ jobs: JobListItem[]; meta: PaginatedMeta }> =>
    apiFetchWithMeta<JobListItem[]>(`/jobs${buildQuery(params)}`).then(({ data, meta }) => ({
      jobs: data,
      meta: meta as unknown as PaginatedMeta,
    })),

  getFilters: (): Promise<JobFilters> => apiFetch<JobFilters>("/jobs/filters"),

  getById: (jobId: string): Promise<JobDetail> => apiFetch<JobDetail>(`/jobs/${jobId}`),
};
