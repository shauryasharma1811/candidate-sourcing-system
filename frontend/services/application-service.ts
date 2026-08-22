import { apiFetch, apiFetchWithMeta } from "@/lib/api-client";
import { getAccessToken } from "@/lib/session";
import {
  ApplicationDetail,
  ApplicationListItem,
  ApplicationProgress,
  ApplicationStatus,
  ApplicationSubmitResult,
  MyApplicationItem,
  PaginatedMeta,
  ResumeDownloadLink,
  ResumeMetadata,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface ApplicationListParams {
  page?: number;
  pageSize?: number;
  status?: ApplicationStatus | "";
  jobId?: string;
  search?: string;
}

function buildQuery(params: ApplicationListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.status) search.set("status", params.status);
  if (params.jobId) search.set("job_id", params.jobId);
  if (params.search) search.set("search", params.search);
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

  // --- Admin-facing: single application, inline status update, resume, export ---
  getAdminDetail: (applicationId: string): Promise<ApplicationDetail> =>
    apiFetch<ApplicationDetail>(`/admin/applications/${applicationId}`),

  updateStatus: (applicationId: string, status: ApplicationStatus): Promise<{ id: string; status: ApplicationStatus }> =>
    apiFetch(`/admin/applications/${applicationId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getResumeDownloadLink: (applicationId: string): Promise<ResumeDownloadLink> =>
    apiFetch<ResumeDownloadLink>(`/admin/applications/${applicationId}/resume`),

  /**
   * CSV/Excel export is a raw file response, not the {success,data} JSON
   * envelope, so it goes around apiFetch: fetch as a blob (to carry the
   * bearer token, which a plain <a href> download link can't), then
   * trigger the browser's save-file flow from an in-memory object URL.
   */
  exportCsv: async (params: Omit<ApplicationListParams, "page" | "pageSize"> = {}): Promise<void> => {
    return applicationService.exportApplications("csv", params);
  },

  /** Excel export (M-1) — same filters, same download flow as exportCsv. */
  exportXlsx: async (params: Omit<ApplicationListParams, "page" | "pageSize"> = {}): Promise<void> => {
    return applicationService.exportApplications("xlsx", params);
  },

  exportApplications: async (
    format: "csv" | "xlsx",
    params: Omit<ApplicationListParams, "page" | "pageSize"> = {}
  ): Promise<void> => {
    const token = getAccessToken();
    const query = buildQuery(params);
    const separator = query ? "&" : "?";
    const res = await fetch(`${API_BASE_URL}/admin/applications/export${query}${separator}format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Couldn't export applications. Please try again.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applications.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  // --- Candidate-facing: guided application flow ---
  getProgress: (jobId: string): Promise<ApplicationProgress> =>
    apiFetch<ApplicationProgress>(`/applications/${jobId}/progress`),

  uploadResume: (jobId: string, file: File): Promise<ResumeMetadata> => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<ResumeMetadata>(`/applications/${jobId}/resume`, { method: "POST", body: formData });
  },

  /**
   * `fetch` doesn't expose upload progress, so this uses XMLHttpRequest
   * directly for the resume upload's progress bar. Uses the same
   * {success,message,data} envelope and bearer-token auth as apiFetch.
   */
  uploadResumeWithProgress: (
    jobId: string,
    file: File,
    onProgress: (percent: number) => void
  ): Promise<ResumeMetadata> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}/applications/${jobId}/resume`);
      const token = getAccessToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && body.success) {
            resolve(body.data as ResumeMetadata);
          } else {
            reject(new Error(body.message || "Couldn't upload the resume. Please try again."));
          }
        } catch {
          reject(new Error("Couldn't upload the resume. Please try again."));
        }
      };
      xhr.onerror = () => reject(new Error("Couldn't upload the resume. Please check your connection."));
      xhr.send(formData);
    });
  },

  deleteResume: (jobId: string): Promise<void> => apiFetch<void>(`/applications/${jobId}/resume`, { method: "DELETE" }),

  submit: (jobId: string, consent: boolean, coverNote?: string): Promise<ApplicationSubmitResult> =>
    apiFetch<ApplicationSubmitResult>(`/applications/${jobId}/submit`, {
      method: "POST",
      body: JSON.stringify({ consent, cover_note: coverNote?.trim() ? coverNote.trim() : null }),
    }),

  listMine: (): Promise<MyApplicationItem[]> => apiFetch<MyApplicationItem[]>("/applications/mine"),
};
