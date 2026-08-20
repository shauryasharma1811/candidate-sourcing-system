/**
 * Session persistence. Access/refresh tokens and the "intended job" redirect
 * target live in localStorage so a page refresh doesn't log the user out.
 * This is the ONLY module that touches these localStorage keys.
 */
const ACCESS_TOKEN_KEY = "css_access_token";
const REFRESH_TOKEN_KEY = "css_refresh_token";
const INTENDED_JOB_KEY = "css_intended_job_id";

function isBrowser() {
  return typeof window !== "undefined";
}

export function saveTokens(accessToken: string, refreshToken: string) {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

/** "Return to intended job after login" — set before redirecting to /login */
export function setIntendedJobId(jobId: string) {
  if (!isBrowser()) return;
  sessionStorage.setItem(INTENDED_JOB_KEY, jobId);
}

export function consumeIntendedJobId(): string | null {
  if (!isBrowser()) return null;
  const jobId = sessionStorage.getItem(INTENDED_JOB_KEY);
  sessionStorage.removeItem(INTENDED_JOB_KEY);
  return jobId;
}

export function peekIntendedJobId(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(INTENDED_JOB_KEY);
}

/** Decode the JWT payload without verifying — for reading role/exp client-side only.
 *  The backend is the sole authority on validity; this is purely UI convenience. */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const [, payloadB64] = token.split(".");
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
