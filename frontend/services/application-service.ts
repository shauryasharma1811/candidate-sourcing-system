import { apiFetchWithMeta } from "@/lib/api-client";
import { ApplicationListItem, ApplicationStatus, PaginatedMeta } from "@/types";

export interface ApplicationListParams {
  page?: number;
  pageSize?: number;
  status?: ApplicationStatus | "";
  jobId?: string;
}

function buildQuery(params: ApplicationListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.status) search.set("status", params.status);
  if (params.jobId) search.set("job_id", params.jobId);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const applicationService = {
  listAdmin: (
    params: ApplicationListParams = {}
  ): Promise<{ applications: ApplicationListItem[]; meta: PaginatedMeta }> =>
    apiFetchWithMeta<ApplicationListItem[]>(`/admin/applications${buildQuery(params)}`).then(({ data, meta }) => ({
      applications: data,
      meta: meta as unknown as PaginatedMeta,
    })),
};
