import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const AIMarketPlace = service("AI-Market-Place", {
    source: github("Hkshoonya/AI-Market-Place", { checkSuites: false }),
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "/Dockerfile",
    },
    start: "node server/custom-server.js",
    healthcheck: "/api/health",
    healthcheckTimeout: 30,
    deploy: {
      restartPolicyMaxRetries: 5,
    },
    replicas: { "us-west2": 1 },
    domains: ["aimarketcap.tech", "www.aimarketcap.tech"],
    networking: { privateNetworkEndpoint: "ai-market-place" },
    env: {
      ANTHROPIC_API_KEY: preserve(),
      ARTIFICIAL_ANALYSIS_API_KEY: preserve(),
      BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY: preserve(),
      CIVITAI_API_KEY: preserve(),
      CRON_RUNNER_MODE: preserve(),
      CRON_SECRET: preserve(),
      CRON_SINGLE_RUN_LOCK: preserve(),
      ENABLE_GITHUB_ACTIONS_CRON: preserve(),
      GITHUB_TOKEN: preserve(),
      GOOGLE_AI_API_KEY: preserve(),
      HUGGINGFACE_API_TOKEN: preserve(),
      NEXT_PUBLIC_POSTHOG_KEY: preserve(),
      NEXT_PUBLIC_SENTRY_DSN: preserve(),
      NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED: preserve(),
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: preserve(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: preserve(),
      NEXT_PUBLIC_SUPABASE_URL: preserve(),
      NODE_ENV: preserve(),
      OPENAI_API_KEY: preserve(),
      OPENROUTER_API_KEY: preserve(),
      PERSIST_INFO_LOGS: preserve(),
      PROVIDER_CREDENTIALS_ENCRYPTION_KEY: preserve(),
      RATE_LIMIT_BACKEND: preserve(),
      REPLICATE_API_TOKEN: preserve(),
      RESEND_API_KEY: preserve(),
      RSSHUB_BASE_URL: preserve(),
      SENTRY_AUTH_TOKEN: preserve(),
      SENTRY_PROJECT: preserve(),
      SENTY_ORG: preserve(),
      SILICONFLOW_API_KEY: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      TWITTER_COOKIE: preserve(),
    },
  });

  return project("AI Market Cap", {
    resources: [AIMarketPlace],
  });
});
