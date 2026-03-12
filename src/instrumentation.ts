import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. Sentry initialised first so startup errors are captured.
    await import("../sentry.server.config");

    // 2. Pipeline startup: validate secrets + seed data_sources table.
    //    validatePipelineSecrets() exits on missing core secrets.
    //    seedDataSources() is idempotent (INSERT … ON CONFLICT DO NOTHING).
    try {
      const { validatePipelineSecrets } = await import(
        "@/lib/pipeline/startup"
      );
      const { seedDataSources } = await import(
        "@/lib/data-sources/seeder"
      );

      await validatePipelineSecrets(); // exits on missing core secrets
      await seedDataSources();         // idempotent INSERT OR IGNORE
    } catch (err) {
      // process.exit() calls propagate — only unexpected errors land here.
      console.error("[instrumentation] Pipeline startup error:", err);
    }

    // 3. MSW server-side interception for E2E tests.
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
