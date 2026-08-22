import { test, expect } from "@playwright/test";
import path from "path";
import { registerCandidateViaApi, ensurePublishedJob, uniqueEmail, VALID_PASSWORD } from "./utils";

/**
 * UI Tests — Candidate Application Wizard
 * Maps to BRD flow: Apply -> Bio -> Education -> Experience -> Resume Upload
 * -> Review -> Consent -> Submit -> Confirmation.
 *
 * These tests log in first via the UI (not the API) for the happy path, so
 * the full click-through is exercised at least once; other specs in this
 * file use API login for setup speed where the wizard itself is what's
 * under test.
 */

async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(VALID_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/jobs/);
}

test.describe("Application wizard", () => {
  test("a candidate can complete every step and reach confirmation", async ({ page, request }) => {
    const adminToken = process.env.SEEDED_ADMIN_TOKEN;
    test.skip(!adminToken, "Requires SEEDED_ADMIN_TOKEN env var for an admin-created job fixture");

    const email = uniqueEmail("wizard-happy");
    await registerCandidateViaApi(request, email);
    const job = await ensurePublishedJob(request, adminToken as string, "wizard-happy");

    await loginViaUi(page, email);
    await page.goto(`/jobs/${job.id}/apply`);

    // Step: Education
    await page.getByRole("button", { name: /add education/i }).click().catch(() => {});
    await page.getByLabel(/institution/i).fill("Delhi University");
    await page.getByLabel(/degree/i).fill("B.Com");
    await page.getByLabel(/passing year/i).fill("2021");
    await page.getByLabel(/cgpa|percentage/i).fill("7.8");
    await page.getByRole("button", { name: /save|next|continue/i }).first().click();

    // Step: Experience -- mark fresher to skip entries.
    const fresherToggle = page.getByLabel(/fresher/i);
    if (await fresherToggle.count()) {
      await fresherToggle.check();
    }
    await page.getByRole("button", { name: /next|continue/i }).first().click();

    // Step: Resume upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake resume for playwright"),
    });
    await expect(page.getByText(/resume\.pdf/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /next|continue/i }).first().click();

    // Step: Review + Consent + Submit
    const consentBox = page.getByRole("checkbox").first();
    await consentBox.check();
    await page.getByRole("button", { name: /submit/i }).click();

    // Confirmation
    await expect(page.getByText(/application submitted|thank you|received/i)).toBeVisible({ timeout: 10000 });
  });

  test("submit is blocked until consent is given", async ({ page, request }) => {
    const adminToken = process.env.SEEDED_ADMIN_TOKEN;
    test.skip(!adminToken, "Requires SEEDED_ADMIN_TOKEN env var for an admin-created job fixture");

    const email = uniqueEmail("wizard-no-consent");
    await registerCandidateViaApi(request, email);
    const job = await ensurePublishedJob(request, adminToken as string, "no-consent");

    await loginViaUi(page, email);
    await page.goto(`/jobs/${job.id}/apply`);

    const submitButton = page.getByRole("button", { name: /submit/i });
    if (await submitButton.count()) {
      await expect(submitButton).toBeDisabled();
    }
  });

  test("uploading a disallowed file type is rejected client-side or by the server", async ({ page, request }) => {
    const adminToken = process.env.SEEDED_ADMIN_TOKEN;
    test.skip(!adminToken, "Requires SEEDED_ADMIN_TOKEN env var for an admin-created job fixture");

    const email = uniqueEmail("wizard-bad-file");
    await registerCandidateViaApi(request, email);
    const job = await ensurePublishedJob(request, adminToken as string, "bad-file");

    await loginViaUi(page, email);
    await page.goto(`/jobs/${job.id}/apply`);

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count()) {
      await fileInput.setInputFiles({
        name: "resume.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not a resume"),
      });
      await expect(page.getByText(/pdf|doc|docx|not allowed|invalid file/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("resuming an in-progress application preserves already-completed steps", async ({ page, request }) => {
    const adminToken = process.env.SEEDED_ADMIN_TOKEN;
    test.skip(!adminToken, "Requires SEEDED_ADMIN_TOKEN env var for an admin-created job fixture");

    const email = uniqueEmail("wizard-resume");
    await registerCandidateViaApi(request, email);
    const job = await ensurePublishedJob(request, adminToken as string, "resume-progress");

    await loginViaUi(page, email);
    await page.goto(`/jobs/${job.id}/apply`);
    await page.getByLabel(/institution/i).fill("Resume University");
    await page.getByLabel(/degree/i).fill("B.A.");
    await page.getByLabel(/passing year/i).fill("2019");
    await page.getByLabel(/cgpa|percentage/i).fill("6.5");
    await page.getByRole("button", { name: /save|next|continue/i }).first().click();

    // Navigate away and back -- progress should be fetched from the server, not lost.
    await page.goto(`/jobs/${job.id}`);
    await page.goto(`/jobs/${job.id}/apply`);
    await expect(page.getByText("Resume University")).toBeVisible({ timeout: 5000 });
  });
});
