import { APIRequestContext, expect } from "@playwright/test";

/** Backend base URL — the frontend proxies to this / calls it directly per services/*.ts. */
export const API_URL = process.env.API_URL ?? "http://localhost:8000/api/v1";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

export const VALID_PASSWORD = "Password123";

/** Registers a fresh candidate directly via the API (fast, avoids re-testing
 * the registration form in every UI test that just needs a logged-in user). */
export async function registerCandidateViaApi(request: APIRequestContext, email: string) {
  const resp = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: VALID_PASSWORD,
      first_name: "UI",
      last_name: "Tester",
      mobile: "+919876543210",
      location: "Bengaluru",
      consent: true,
    },
  });
  expect(resp.ok()).toBeTruthy();
  return resp.json();
}

/** Creates + publishes a job via an admin session so job-browsing tests
 * always have at least one Published job to find, independent of seed data. */
export async function ensurePublishedJob(request: APIRequestContext, adminToken: string, titleSuffix: string) {
  const title = `UI Test Role ${titleSuffix}`;
  const create = await request.post(`${API_URL}/admin/requisitions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      title,
      department: "Engineering",
      location: "Remote",
      employment_type: "Full-Time",
      experience_required: "1-3 years",
      openings: 1,
      hiring_manager: "UI Suite",
      max_salary: "1000000.00",
      hiring_completion_date: "2027-01-31",
      description: "Seed job created by the Playwright UI suite.",
      requirements: "N/A",
    },
  });
  expect(create.ok()).toBeTruthy();
  const job = (await create.json()).data;
  const publish = await request.post(`${API_URL}/admin/requisitions/${job.id}/publish`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(publish.ok()).toBeTruthy();
  return { ...job, title };
}
