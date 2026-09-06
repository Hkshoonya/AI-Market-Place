# Connected Runpod Pods

## Commercial boundary

Users connect their own Runpod account and pay Runpod directly. No platform master
key, AI Market Cap wallet debit, Stripe charge, or compute markup is used. The
existing admin-managed `/go/runpod` link provides disclosed referral onboarding.
Referral attribution and rewards remain Runpod's responsibility; an API connection
or a click is not evidence of an eligible referral or cash revenue.

## Implemented flow

- `/settings/providers`: validate Runpod account identity and encrypt a dedicated key.
- `/workspace/pods`: live single-GPU availability, estimates, charge consent and launches.
- Qwen3 4B Instruct 2507 and Qwen3 8B starter recipes, pinned to reviewed model revisions.
- Secure Cloud, one supported 24-80 GB NVIDIA GPU, 30 GB container disk, 30/50/100 GB Pod volume.
- vLLM v0.28.0 pinned by registry digest, CUDA 13.0 constraint and 8K context.
- Refresh, stop, resume and destructive-confirmed termination of resources created here only.
- A dedicated per-Pod API key and an OpenAI-compatible text-chat endpoint.
- Visible-page status reconciliation every 30 seconds, with manual refresh and a Runpod console fallback.

Pricing is a live GPU estimate, not a hard budget cap, reservation or complete
invoice. Storage, taxes and other provider charges are additional. A start/resume
request rechecks availability and rejects an increased advertised GPU price.
Runpod can still select a different actual rate; the last provider-reported rate
is displayed separately. GPU allocation does not mean the model API is ready.

There is no automatic idle stop, billing reconciliation, usage invoice, managed
chat UI, imported existing Pods, arbitrary container support, SSH, gated-model
token injection or multi-GPU deployment in this first version. Stopped volumes
can continue to cost money. Termination deletes local Pod data. Users must retain
direct access to their Runpod console.

## Security and duplicate prevention

The new control-plane table is service-role-only under RLS. Every route checks a
real session, a non-banned profile and explicit ownership before credentials or
resources are accessed. Mutations require a trusted origin and per-user limits.
No credentials appear in URLs, list responses or upstream error messages.

`claim_runpod_quote` locks the provider connection, checks its account identity,
atomically consumes a five-minute quote once, and limits an account connection to
three nonterminal Pods. A database trigger prevents disconnection/account changes
while any tracked Pod may still exist. Same-account key rotation is permitted.
Per-Pod operation leases serialize status updates and lifecycle controls.

Create timeouts and malformed responses remain `unknown`, because Runpod might
have allocated a billable Pod. They are never automatically retried. Recovery
uses the exact `aimc-<record UUID>` name and verifies the remote account and ID.
An ambiguous or absent result does not permit another automatic create attempt.

The serving gateway is installed from application-owned source at startup. It
authenticates all HTTP requests, denies every route except GET `/v1/models` and
POST `/v1/chat/completions`, accepts text-only messages, caps bodies at 64 KiB,
messages at 64, output at 2,048 tokens and concurrent chat requests at four. It
blocks media URLs, tools, custom sampling extensions and administrative endpoints.
No remote model code is enabled. The gateway is required because vLLM's native
API key does not protect all its endpoints.

## Rollout gate

1. Merge the prerequisite automation/revenue PR and this feature after required reviews.
2. Apply migration `099_add_runpod_connected_pods.sql` before deploying this code.
3. Verify `PROVIDER_CREDENTIALS_ENCRYPTION_KEY` is configured with 32 base64-encoded bytes. Never replace an existing key without migrating encrypted records.
4. Keep `RUNPOD_PODS_ENABLED=false` in public production until verification is complete. Account connections and estimates work; paid launch/resume are blocked. Stop/terminate remain available.
5. In a restricted staging environment, enable the flag and connect a dedicated funded test account. Obtain an explicit spend budget before a real launch.
6. Launch the 4B recipe once, verify repeat-click/idempotent behavior, wait for authenticated API readiness, send one bounded chat request, and verify unauthenticated and admin requests fail.
7. Stop, verify provider status and storage warning, resume after charge consent, terminate after backing up test data, and verify the Pod is absent in Runpod. Check actual charges in the provider console.
8. Verify two real users cannot read, control or reveal credentials for each other's records. Then enable production launch for the reviewed rollout.

No paid GPU smoke test has been performed during implementation. CPU-only tests
do not establish that a GPU can be allocated, that a model boots on every listed
machine, or that billing/referral attribution works.

## Verification commands

```sh
npx vitest run --project unit src/lib/runpod src/app/api/workspace/pods
npx vitest run --project component 'src/app/(auth)/workspace/pods/pods-content.test.tsx'
node scripts/verify-runpod-schema.mjs
npm run typecheck
npm run lint
npm run build
```

The schema script creates and removes a disposable local PostgreSQL 17 Docker
container. It never reads production database credentials. Gateway tests execute
the actual ASGI middleware using Python 3 without starting vLLM or a GPU.

## Operational recovery

- Unknown launch: find the exact `aimc-<UUID>` in the original Runpod account; refresh to adopt a single identity-verified result. Do not retry creation.
- If absence is conclusively verified with Runpod support, an operator may mark the record `failed`. Never automatically infer absence from a timeout or one empty listing.
- If keys are revoked, reconnect a key for the same Runpod account or manage the Pod directly in Runpod. Do not switch the connection to another account.
- If controls fail, use the Runpod console immediately. Disabling the launch flag does not stop existing resources.
- Account deletion is blocked while tracked Pods may still exist, to prevent orphaned spend. Once resources are confirmed terminated, normal deletion also removes quote/history records.
- Do not automatically upgrade the image/model revisions. Review security advisories and run the live smoke test before changing recipes.

## Primary sources checked 2026-09-06

- [Runpod REST Pod API](https://docs.runpod.io/api-reference/pods/POST/pods)
- [Runpod GraphQL schema](https://graphql-spec.runpod.io/)
- [Runpod storage lifecycle](https://docs.runpod.io/pods/storage/types)
- [Runpod referral terms](https://docs.runpod.io/accounts-billing/referrals)
- [vLLM v0.28.0](https://github.com/vllm-project/vllm/releases/tag/v0.28.0)
- [vLLM security limitations](https://docs.vllm.ai/en/latest/usage/security/)
- [Qwen3 4B Instruct](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)
- [Qwen3 8B](https://huggingface.co/Qwen/Qwen3-8B)
