import { apiFetch, apiFetchWithMeta } from "@/lib/api-client";
import { JobStatus, PaginatedMeta, RequisitionDetail, RequisitionFormInput, RequisitionListItem } from "@/types";

export interface RequisitionListParams {
  page?: number;
  pageSize?: number;
  status?: JobStatus | "";
  q?: string;
}

function buildQuery(params: RequisitionListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const requisitionService = {
  list: (params: RequisitionListParams = {}): Promise<{ requisitions: RequisitionListItem[]; meta: PaginatedMeta }> =>
    apiFetchWithMeta<RequisitionListItem[]>(`/admin/requisitions${buildQuery(params)}`).then(({ data, meta }) => ({
      requisitions: data,
      meta: meta as unknown as PaginatedMeta,
    })),

  get: (jobId: string): Promise<RequisitionDetail> => apiFetch<RequisitionDetail>(`/admin/requisitions/${jobId}`),

  create: (payload: RequisitionFormInput): Promise<RequisitionDetail> =>
    apiFetch<RequisitionDetail>("/admin/requisitions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (jobId: string, payload: RequisitionFormInput): Promise<RequisitionDetail> =>
    apiFetch<RequisitionDetail>(`/admin/requisitions/${jobId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};
