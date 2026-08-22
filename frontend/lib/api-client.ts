/**
 * Central fetch wrapper. Every backend call goes through here so that
 * auth headers, base URL, the {success,message,data} envelope, and
 * silent access-token refresh are handled in exactly one place.
 */
import { clearSession, getAccessToken, getRefreshToken, saveTokens } from "./session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  message: string;
  errors: unknown[];
}

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  // Coalesce concurrent 401s into a single refresh call
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = (await res.json()) as ApiSuccess<{ access_token: string; refresh_token: string }>;
        if (!body.success) return false;
        saveTokens(body.data.access_token, body.data.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, _retried = false): Promise<ApiSuccess<T>> {
  const accessToken = getAccessToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      // Let the browser set multipart/form-data (with boundary) itself for uploads.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  // Access token expired mid-session -> silently refresh once, then retry
  if (res.status === 401 && !_retried && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    clearSession();
  }

  const body = (await res.json()) as ApiSuccess<T> | ApiError;

  if (!body.success) {
    throw new ApiRequestError(body.message, res.status);
  }
  return body;
}

/** Most callers only need the payload. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = await request<T>(path, options);
  return body.data;
}

/** Paginated endpoints (e.g. job listing) also need the {page,total,...} meta block. */
export async function apiFetchWithMeta<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const body = await request<T>(path, options);
  return { data: body.data, meta: body.meta };
}
