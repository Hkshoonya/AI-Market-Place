import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // MSW server-side interception for E2E tests.
    // Only active when NEXT_PUBLIC_E2E_MSW=true (set by playwright.config.ts
    // webServer.env and the CI e2e job env block). Never set in production.
    if (process.env.NEXT_PUBLIC_E2E_MSW === "true") {
      const { server } = await import("../e2e/mocks/server");
      server.listen({ onUnhandledRequest: "bypass" });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
