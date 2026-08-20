import { apiFetch } from "@/lib/api-client";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in_minutes: number;
  redirect_to: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  role: "Admin" | "Candidate";
  first_name: string;
  last_name: string;
}

export interface CandidateRegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  mobile: string;
  location?: string;
  consent: boolean;
}

export const authService = {
  registerCandidate: (payload: CandidateRegisterPayload) =>
    apiFetch<TokenPair>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),

  loginCandidate: (email: string, password: string, intendedJobId?: string | null) =>
    apiFetch<TokenPair>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, intended_job_id: intendedJobId ?? undefined }),
    }),

  loginAdmin: (email: string, password: string) =>
    apiFetch<TokenPair>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<null>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<null>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  getProfile: () => apiFetch<UserProfile>("/auth/me", { method: "GET" }),
};
