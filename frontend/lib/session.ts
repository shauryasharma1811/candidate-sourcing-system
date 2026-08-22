/**
 * Session persistence. Access/refresh tokens and the "intended job" redirect
 * target live in localStorage so a page refresh doesn't log the user out.
 * This is the ONLY module that touches these localStorage keys.
 *
 * SECURITY NOTE (H-4 — tokens in localStorage vs. httpOnly cookies):
 * localStorage is readable by any JS running on the page, so a successful
 * XSS anywhere in the app becomes a session-compromising token theft.
 * httpOnly cookies would close that specific vector, but migrating to them
 * is a real architecture change here, not a config flag — this is a
 * bearer-token API (Authorization header) with a stateless FastAPI backend,
 * no server-side session store, and CORS already configured for a
 * cross-origin frontend/backend split. Moving to cookies would require:
 * backend endpoints to Set-Cookie instead of returning tokens in the body,
 * `credentials: "include"` + matching CORS `allow_credentials`/exact-origin
 * config on every request, a CSRF-mitigation strategy (SameSite alone isn't
 * sufficient for a cross-origin setup), and reworking the refresh-token flow
 * and any non-browser API consumers that currently rely on the bearer token.
 * That's a coordinated backend+frontend change, not a "swap storage" patch,
 * so per the audit's own guidance it's being tracked as follow-up work
 * rather than done as a minimal fix here. In the meantime, the mitigation
 * in place is: no `dangerouslySetInnerHTML` anywhere in the app (React's
 * default escaping is relied on everywhere), all user-generated text is
 * rendered as text/props (never interpolated into HTML/scripts), and a
 * strict CORS allowlist (see CORS_ORIGINS) limits which origins can even
 * receive credentialed responses. Treat this file as the single choke
 * point if/when cookie-based storage is implemented.
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
