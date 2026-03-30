# One-Click Model Deployment and Credits Plan

Status: deferred design slice, feasible with current platform primitives

## Goal

Let a user viewing a model page:

1. click `Deploy`
2. choose a ready deployment target
3. fund usage with credits
4. immediately use the deployed model through:
   - a hosted chat playground
   - an API endpoint
5. pay a platform fee on top of deployment/provider cost

This should work without forcing the user to manage raw provider credentials for the common path.

## Why This Is Feasible

The current codebase already has the key building blocks:

- model access and deployment catalogs
  - `src/lib/models/access-offers.ts`
  - `src/lib/models/deployments.ts`
- deployment source-of-truth tables
  - `deployment_platforms`
  - `model_deployments`
- wallets, credits, escrow, and transaction history
  - `supabase/migrations/003_wallet_system.sql`
  - `src/lib/payments/wallet.ts`
- API-key issuance and wallet-backed API charging
  - `src/app/api/api-keys/route.ts`
  - `src/lib/middleware/api-paywall.ts`
- marketplace order and fulfillment patterns
  - `src/lib/marketplace/purchase-handlers.ts`
  - `src/lib/marketplace/delivery.ts`

So this is not a greenfield feature. It is a productization layer on top of primitives the repo already owns.

## Product Shape

### 1. Deploy From Model Page

On any model page with a supported deployment route:

- show `Deploy instantly`
- show estimated starting cost, for example:
  - `$1 starter deploy`
  - `$20 recommended credits`
- let user pick one of:
  - `Hosted by AI Market Cap`
  - `Deploy on provider`
  - `Bring your own key` later, not phase 1

### 2. Credits Wallet

Wallet should support two modes:

- credit packs:
  - `$20`
  - `$40`
  - `$60`
  - `$100`
- pay as you go after initial funding

Credits remain wallet-denominated in USD-equivalent accounting. The existing wallet ledger already matches this model better than inventing a second credit balance.

### 3. Runtime Outputs After Deploy

After successful deploy/setup, the user gets:

- deployment status
- provider/runtime name
- spend meter
- hosted chat UI
- API base URL
- scoped API key

### 4. Charging Model

Charge stack should be:

- provider/deployment base cost
- optional startup/minimum deploy fee
- platform margin
- usage debits from wallet per request

The first deploy can start at `$1` only when the backing runtime actually supports that floor. Otherwise the UI should say `starts around $X` and not fake a universal `$1` promise.

## Recommended Implementation Phases

### Phase 1: Hosted Access Layer

Fastest shippable version.

User clicks `Deploy`, but under the hood we do not spin isolated infra per user yet.

Instead:

- create a `user_model_runtime` record
- bind the user to a supported access route already available in `model_deployments`
- mint a scoped API key
- expose:
  - chat UI
  - API endpoint proxied through our paywall
- debit wallet per use

This gives the user the feeling of one-click deployment with much lower infra complexity.

Best for:

- OpenRouter
- provider-hosted APIs
- subscription-backed provider access
- curated hosted routes

### Phase 2: True Dedicated Deployments

For platforms where we can actually provision dedicated runtimes:

- Replicate
- Modal
- RunPod
- self-hosted GPU providers

Add an async provisioner:

- create deployment job
- call provider API
- poll status
- surface logs and endpoint URL

This should not block Phase 1.

## Data Model Additions

Recommended new tables:

### `user_model_runtimes`

- `id`
- `user_id`
- `model_id`
- `platform_id`
- `status`
  - `pending`
  - `ready`
  - `failed`
  - `paused`
  - `deleted`
- `runtime_type`
  - `shared_proxy`
  - `dedicated_provider`
  - `subscription_access`
- `provider_runtime_id`
- `api_base_url`
- `chat_enabled`
- `wallet_id`
- `pricing_snapshot`
- `created_at`
- `updated_at`

### `runtime_usage_events`

- `id`
- `runtime_id`
- `user_id`
- `request_type`
  - `chat`
  - `completion`
  - `embedding`
  - `image`
- `input_units`
- `output_units`
- `provider_cost`
- `platform_fee`
- `wallet_transaction_id`
- `created_at`

### `runtime_deploy_jobs`

- `id`
- `runtime_id`
- `status`
- `attempt_count`
- `provider_request`
- `provider_response`
- `last_error`
- `started_at`
- `completed_at`

## API Surface

Recommended endpoints:

- `POST /api/runtimes`
  - create one-click runtime from a model page
- `GET /api/runtimes`
  - list user runtimes
- `GET /api/runtimes/[id]`
  - runtime status, endpoint, usage summary
- `POST /api/runtimes/[id]/chat`
  - hosted chat interaction
- `POST /api/runtimes/[id]/keys`
  - create scoped runtime API key
- `POST /api/runtimes/[id]/pause`
- `POST /api/runtimes/[id]/resume`
- `DELETE /api/runtimes/[id]`

## Payments and Risk Controls

### Credit Funding

Keep wallet funding simple:

- fixed packs first
- on-chain deposit remains supported
- card/Stripe can be added later if wanted

### Usage Debits

Debit at request time using the existing wallet ledger model:

- preflight price estimate
- reserve if needed for expensive requests
- finalize debit after provider usage returns

### Security Rules

Money-moving and runtime creation should require:

- authenticated user
- verified wallet existence
- positive balance or successful top-up
- rate limiting
- idempotency key on runtime creation
- per-runtime scoped API keys
- strict server-side provider secret custody

Do not expose provider API keys client-side.

## UI Flow

### Model Page

Replace the passive deploy card with:

- `Deploy instantly`
- `Use via API`
- `Start chat`
- `Estimated cost`

### Deploy Modal

Sections:

- deployment route
- pricing estimate
- credit pack top-up
- confirm button

### Runtime Console

After creation:

- status banner
- chat panel
- API endpoint block
- copy API key
- usage and spend meter

## Pricing Guidance

Use this pricing shape:

- starter activation fee:
  - `from $1` only where supported
- main top-ups:
  - `$20`
  - `$40`
  - `$60`
  - `$100`
- after that:
  - pay as you go

Platform should keep a minimum balance threshold for expensive runtimes so usage does not start with obviously insufficient funds.

## Recommended Build Order

1. Add `user_model_runtimes` schema and runtime API.
2. Implement shared-proxy runtime creation for already-supported provider routes.
3. Add wallet top-up packs to the wallet page.
4. Add runtime chat and scoped runtime API keys.
5. Add per-request wallet debits using existing paywall patterns.
6. Add dedicated deployment jobs for the platforms that support true provisioning.

## Non-Goals For Phase 1

- full multi-cloud infra orchestration
- arbitrary Docker deployment from user prompts
- unmanaged bring-your-own-cluster flows
- exposing raw provider credentials to the browser

## Current Blockers

- no dedicated `user runtime` schema yet
- no runtime-specific chat/API console yet
- deployment catalog is present, but still mostly informational
- pricing normalization across deployment platforms still needs stronger precision before promising universal one-click deploy pricing

## Recommendation

Build Phase 1 first.

That gives users the outcome they want:

- one click from model page
- immediate chat/API use
- wallet-funded credits
- platform monetization

without waiting for full dedicated infra provisioning.
