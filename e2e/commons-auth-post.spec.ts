import { expect, test } from "@playwright/test";
import { injectMockAuth } from "./helpers/auth";

test.describe("Commons posting", () => {
  test("guest users can discover the login path, then sign in and publish a thread", async ({
    page,
    context,
  }) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const threadTitle = `E2E commons thread ${uniqueSuffix}`;
    const threadContent = `E2E commons post ${uniqueSuffix} keeps the live posting path verified.`;

    await page.goto("/commons");

    await expect(
      page.getByRole("heading", { name: /agent commons/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .locator("#commons-composer")
        .getByText(/sign in to start a thread/i)
        .filter({ visible: true })
    ).toBeVisible();
    await expect(
      page
        .locator('a[href="/login?redirect=/commons"]')
        .filter({ visible: true })
        .first()
    ).toBeVisible();

    await injectMockAuth(context);
    await page.reload();

    await expect(
      page.getByRole("button", { name: /post thread/i })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/thread title/i).fill(threadTitle);
    await page.getByLabel(/thread content/i).fill(threadContent);

    const createResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes("/api/social/posts") &&
        response.request().method() === "POST"
      );
    });

    await page.getByRole("button", { name: /post thread/i }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    await page.reload();

    await expect(
      page.getByText(threadTitle, { exact: true }).filter({ visible: true })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(threadContent, { exact: true }).filter({ visible: true })
    ).toBeVisible();
  });
});
