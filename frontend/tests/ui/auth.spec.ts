import { test, expect } from "@playwright/test";
import { uniqueEmail, VALID_PASSWORD } from "./utils";

/**
 * UI Tests — Authentication
 * Maps to BRD: Register -> Login -> Access Token -> Refresh, and the
 * "return to intended job" behaviour after login/register.
 */

test.describe("Candidate registration", () => {
  test("registering with valid details redirects into the app", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("First name").fill("Asha");
    await page.getByLabel("Last name").fill("Verma");
    await page.getByLabel("Email").fill(uniqueEmail("register-ok"));
    await page.getByLabel("Mobile").fill("+919812345678");
    await page.getByLabel("Location").fill("Delhi");
    await page.getByLabel("Password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: /create account|sign up|register/i }).click();

    await expect(page).not.toHaveURL(/\/auth\/register/);
  });

  test("weak password is rejected with a clear validation message", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("First name").fill("Asha");
    await page.getByLabel("Last name").fill("Verma");
    await page.getByLabel("Email").fill(uniqueEmail("register-weak"));
    await page.getByLabel("Mobile").fill("+919812345678");
    await page.getByLabel("Password").fill("weak");
    await page.getByRole("button", { name: /create account|sign up|register/i }).click();

    await expect(page).toHaveURL(/\/auth\/register/);
    await expect(page.getByText(/password/i)).toBeVisible();
  });

  test("duplicate email is rejected (BRD: email unique)", async ({ page, request }) => {
    const email = uniqueEmail("dup");
    const { registerCandidateViaApi } = await import("./utils");
    await registerCandidateViaApi(request, email);

    await page.goto("/auth/register");
    await page.getByLabel("First name").fill("Asha");
    await page.getByLabel("Last name").fill("Verma");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mobile").fill("+919812345678");
    await page.getByLabel("Password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: /create account|sign up|register/i }).click();

    await expect(page.getByText(/already|exists|taken/i)).toBeVisible();
  });
});

test.describe("Candidate login", () => {
  test("valid credentials log the candidate in", async ({ page, request }) => {
    const email = uniqueEmail("login-ok");
    const { registerCandidateViaApi } = await import("./utils");
    await registerCandidateViaApi(request, email);

    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/jobs/);
  });

  test("wrong password shows an error and does not navigate away", async ({ page, request }) => {
    const email = uniqueEmail("login-bad");
    const { registerCandidateViaApi } = await import("./utils");
    await registerCandidateViaApi(request, email);

    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("TotallyWrong123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/invalid|incorrect|does not match/i)).toBeVisible();
  });

  test("unknown email does not leak whether the account exists", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(uniqueEmail("never-registered"));
    await page.getByLabel("Password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Same generic message as a wrong-password case — no "no such user" text.
    await expect(page.getByText(/no account|not found|doesn't exist/i)).toHaveCount(0);
  });
});

test.describe("Protected routes and intended-job redirect", () => {
  test("visiting the apply page while logged out redirects to login", async ({ page }) => {
    await page.goto("/jobs");
    const firstJobLink = page.getByRole("link").filter({ hasText: /./ }).first();
    // Fall back to a direct navigation if no jobs are seeded yet.
    await page.goto("/jobs/00000000-0000-0000-0000-000000000000/apply");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("logging in after being redirected returns the candidate to the job they wanted", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("intended-job");
    const { registerCandidateViaApi, ensurePublishedJob } = await import("./utils");
    await registerCandidateViaApi(request, email);

    const adminToken = process.env.SEEDED_ADMIN_TOKEN;
    test.skip(!adminToken, "Requires SEEDED_ADMIN_TOKEN env var for an admin-created job fixture");
    const job = await ensurePublishedJob(request, adminToken as string, "intended");

    await page.goto(`/jobs/${job.id}/apply`);
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(new RegExp(`/jobs/${job.id}/apply`));
  });
});
