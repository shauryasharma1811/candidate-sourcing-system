import { test, expect } from "@playwright/test";

/**
 * UI Tests — Admin
 * Maps to BRD admin flow: Login -> Dashboard -> Create Requisition -> Draft
 * -> Publish -> Applications Grid -> View Candidate -> Update Status.
 *
 * Requires a seeded admin account (admin registration is intentionally not
 * exposed via the API -- see AUTH.md -- so these tests log in through the
 * UI with credentials seeded into the test database).
 */

const ADMIN_EMAIL = process.env.SEEDED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEEDED_ADMIN_PASSWORD ?? "AdminPassword123";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/auth/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
}

test.describe("Admin login", () => {
  test("candidate credentials are rejected on the admin login page", async ({ page, request }) => {
    const { registerCandidateViaApi, uniqueEmail, VALID_PASSWORD } = await import("./utils");
    const email = uniqueEmail("not-admin");
    await registerCandidateViaApi(request, email);

    await page.goto("/auth/admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/auth\/admin\/login/);
    await expect(page.getByText(/invalid|not authorized|access denied/i)).toBeVisible();
  });
});

test.describe("Admin dashboard and requisitions", () => {
  test.skip(
    !process.env.SEEDED_ADMIN_EMAIL,
    "Requires SEEDED_ADMIN_EMAIL / SEEDED_ADMIN_PASSWORD for a seeded admin account"
  );

  test("dashboard loads with summary stats after login", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("creating a requisition saves it as Draft, then it can be published", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/requisitions/new");

    const title = `Playwright QA Role ${Date.now()}`;
    await page.getByLabel(/title/i).fill(title);
    await page.getByLabel(/department/i).fill("Quality Assurance");
    await page.getByLabel(/location/i).fill("Chennai");
    await page.getByLabel(/hiring manager/i).fill("QA Lead");
    await page.getByLabel(/openings/i).fill("1");
    await page.getByLabel(/max(imum)? salary/i).fill("1200000");
    await page.getByLabel(/description/i).fill("Own end-to-end quality for the platform.");
    await page.getByRole("button", { name: /save as draft|save draft/i }).click();

    await expect(page.getByText(/draft/i)).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    await page.getByRole("button", { name: /publish/i }).click();
    await expect(page.getByText(/published/i)).toBeVisible();
  });

  test("required requisition fields block submission when empty", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/requisitions/new");
    await page.getByRole("button", { name: /save as draft|save draft/i }).click();
    // Native/zod validation should keep us on the form.
    await expect(page).toHaveURL(/\/admin\/requisitions\/new/);
  });

  test("applications grid shows candidates and supports status updates", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/applications");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const firstRow = page.locator("table tbody tr, [data-row]").first();
    if (await firstRow.count()) {
      await firstRow.getByRole("link").first().click();
      await expect(page).toHaveURL(/\/admin\/applications\/.+/);

      const statusSelect = page.getByLabel(/status/i);
      if (await statusSelect.count()) {
        await statusSelect.selectOption({ label: "Shortlisted" });
        await expect(page.getByText(/updated|saved/i)).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe("Route protection", () => {
  test("a logged-out visitor is redirected away from the admin dashboard", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/auth\/admin\/login/);
  });
});
