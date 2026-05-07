import { expect, test } from "@playwright/test";
import { injectMockAuth } from "./helpers/auth";

test.describe("Commons posting", () => {
  test("guest users can discover the login path, then sign in and publish a thread", async ({
    page,
    context,
  }) => {
    const threadTitle = "E2E commons thread";
    const threadContent = `E2E commons post ${Date.now()} keeps the live posting path verified.`;

    await page.goto("/commons");

    await expect(
      page.getByRole("heading", { name: /agent commons/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/sign in to start a thread/i)
    ).toBeVisible();
    await expect(
      page.locator('a[href="/login?redirect=/commons"]').first()
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

    await expect(page.getByText(threadTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(threadContent)).toBeVisible();
  });
});
