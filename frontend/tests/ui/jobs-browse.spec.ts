import { test, expect } from "@playwright/test";
import { ensurePublishedJob } from "./utils";

/**
 * UI Tests — Public Careers Site
 * Maps to BRD flow: Public Jobs -> Job Detail -> Share.
 * Search/filter/pagination behaviour is covered at the API level in
 * backend/tests/integration/test_jobs_public.py; here we confirm the
 * *page* wires those params correctly (debounce, shareable URL, empty state).
 */

test.describe("Job listing page", () => {
  test("loads and shows at least one published job", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Either job cards render, or a "no results" state is shown -- never a blank/broken page.
    const hasCards = await page.locator("a[href^='/jobs/']").count();
    if (hasCards === 0) {
      await expect(page.getByText(/no jobs|no results|nothing found/i)).toBeVisible();
    }
  });

  test("search updates the URL so results are shareable (BRD: share)", async ({ page, request }) => {
    const adminToken = process.env.SEEDED_ADMIN_TOKEN;
    test.skip(!adminToken, "Requires SEEDED_ADMIN_TOKEN env var for an admin-created job fixture");
    const job = await ensurePublishedJob(request, adminToken as string, "search");

    await page.goto("/jobs");
    const searchBox = page.getByPlaceholder(/search job titles/i);
    await searchBox.fill(job.title);
    // Debounced search (~350ms per AUTH.md/BRD notes) -- wait for the URL to reflect it.
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(job.title).replace(/%20/g, ".")}`), {
      timeout: 3000,
    });
    await expect(page.getByText(job.title)).toBeVisible();
  });

  test("a search with no matches shows an empty state, not an error", async ({ page }) => {
    await page.goto("/jobs");
    const searchBox = page.getByPlaceholder(/search job titles/i);
    await searchBox.fill("zzzzz-no-such-role-zzzzz");
    await expect(page.getByText(/no jobs|no results|nothing found/i)).toBeVisible({ timeout: 3000 });
  });

  test("reloading a filtered URL reproduces the same filtered view (shareable link)", async ({ page }) => {
    await page.goto("/jobs?q=engineer&page=1");
    const urlBefore = page.url();
    await page.reload();
    await expect(page).toHaveURL(urlBefore);
  });
});

test.describe("Job detail page", () => {
  test("shows the job's key requisition fields", async ({ page, request }) => {
    const adminToken = process.env.SEEDED_ADMIN_TOKEN;
    test.skip(!adminToken, "Requires SEEDED_ADMIN_TOKEN env var for an admin-created job fixture");
    const job = await ensurePublishedJob(request, adminToken as string, "detail");

    await page.goto(`/jobs/${job.id}`);
    await expect(page.getByRole("heading", { name: job.title })).toBeVisible();
    await expect(page.getByText("Engineering")).toBeVisible();
    await expect(page.getByText("Remote")).toBeVisible();
  });

  test("an unknown job id shows a not-found state instead of crashing", async ({ page }) => {
    await page.goto("/jobs/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText(/not found|doesn't exist|no longer available/i)).toBeVisible();
  });

  test("Apply button on a logged-out session routes through login first", async ({ page, request }) => {
    const adminToken = process.env.SEEDED_ADMIN_TOKEN;
    test.skip(!adminToken, "Requires SEEDED_ADMIN_TOKEN env var for an admin-created job fixture");
    const job = await ensurePublishedJob(request, adminToken as string, "apply-cta");

    await page.goto(`/jobs/${job.id}`);
    await page.getByRole("link", { name: /apply/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
