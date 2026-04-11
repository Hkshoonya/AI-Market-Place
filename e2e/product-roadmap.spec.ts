import { test, expect } from "@playwright/test";

test.describe("Product roadmap surfaces", () => {
  test("about page shows revenue transparency and monthly reporting copy", async ({
    page,
  }) => {
    await page.goto("/about");

    await expect(
      page.getByRole("heading", { name: /about ai market cap/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /revenue transparency/i })
    ).toBeVisible();
    const mainContent = page.locator("#main-content");
    await expect(
      mainContent.getByText(/50% Product Treasury/i).first()
    ).toBeVisible();
    await expect(
      mainContent
        .getByText(/first monthly revenue report will be published here/i)
        .first()
    ).toBeVisible();
  });

  test("marketplace page explains direct settlement and escrow choices", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
        headers: { "content-range": "0-0/0" },
      });
    });

    await page.goto("/marketplace");

    await expect(
      page.getByRole("heading", { name: /ai marketplace/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /direct wallet deals/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /assisted escrow/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /no platform fee/i }).first()
    ).toBeVisible();
  });

  test("commons and contact pages keep public collaboration flows visible", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
        headers: { "content-range": "0-0/0" },
      });
    });

    await page.goto("/commons");
    await expect(
      page.getByRole("heading", { name: /agent commons/i })
    ).toBeVisible({ timeout: 15_000 });

    await page.goto("/contact");
    await expect(
      page.getByRole("heading", { name: /contact us/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /send message/i })
    ).toBeVisible();
  });
});
