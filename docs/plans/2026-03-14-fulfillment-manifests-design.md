# Protocol-Native Fulfillment Manifests Design

## Goal

Move the marketplace from ad hoc delivery-by-listing-type toward a machine-readable fulfillment contract that is safe to preview publicly, immutable per purchase, and suitable for future autonomous agent-to-agent commerce.

## Problem

The current marketplace has partial manifest support, but it is fragmented:

- `agent_config.skill_manifest` exists for some bot-created listings
- `mcp_manifest` exists for some MCP server listings
- public `/manifest` only exposes the narrow skill-manifest case
- `deliverDigitalGood(...)` still branches mostly on `listing_type`
- order delivery does not snapshot the purchased contract

That leaves three gaps:

1. buyers cannot reliably inspect a normalized, safe preview before purchase
2. purchased orders do not hold an immutable fulfillment contract
3. agent-native buyers do not have one stable machine-readable surface

## Decision

Use a hybrid model:

- public listings expose a safe preview manifest
- successful purchase snapshots a full fulfillment manifest onto the order
- delivery reads the order snapshot first, not the listing's latest state

This matches standard marketplace expectations better than a live-only manifest, because buyers need the exact contract they purchased even if the listing changes later.

## Approaches Considered

### Option 1: Live Manifest Only

Always generate fulfillment from the latest listing state.

Pros:
- simplest implementation
- minimal schema change

Cons:
- sellers can mutate the product after purchase
- weak auditability
- unsafe for automated agent buyers

### Option 2: Immutable Order Snapshot

Generate a full manifest at purchase time and store it on the order.

Pros:
- strong auditability
- stable delivery contract
- standard marketplace behavior

Cons:
- no safe public preview by itself
- still needs listing-side explanation for discovery

### Option 3: Hybrid Snapshot + Listing Preview

Expose a public preview on the listing and create an immutable full snapshot per order.

Pros:
- safest public browsing model
- strongest buyer trust
- supports human and agent-native discovery
- future-proofs the marketplace for protocol-native automation

Cons:
- larger implementation surface than a narrow patch

### Recommendation

Use Option 3.

## Manifest Model

Introduce one normalized fulfillment contract that works across listing types.

### Preview Manifest

Public, safe to expose before purchase.

Purpose:
- explain what the listing is
- explain what the buyer gets in general terms
- support machine-readable discovery without exposing proprietary or sensitive internals

### Fulfillment Manifest Snapshot

Private, immutable, created at purchase or seller completion time.

Purpose:
- define exactly what was sold for that order
- drive delivery
- preserve auditability for disputes, support, and autonomous execution

## Canonical Manifest Shape

Both preview and snapshot use the same broad schema, with the snapshot allowing richer private fields.

Core fields:

- `schema_version`
- `listing_type`
- `fulfillment_type`
- `title`
- `summary`
- `capabilities`
- `runtime`
- `pricing_model`
- `artifacts`
- `access`
- `verification`
- `support`
- `rights`

Additional snapshot-only fields:

- `listing_id`
- `listing_slug`
- `listing_version_hash`
- `purchased_at`
- `buyer_scope`
- `delivery_steps`
- `access_grants`
- `artifact_refs`
- `integrity_hash`

## Storage

Additive schema only.

### Listing Storage

Add `preview_manifest jsonb` to `marketplace_listings`.

Compatibility:
- keep `mcp_manifest`
- keep `agent_config.skill_manifest`
- derive `preview_manifest` from those older fields when explicit preview data is missing

### Order Storage

Add `fulfillment_manifest_snapshot jsonb` to `marketplace_orders`.

Compatibility:
- keep `delivery_data`
- continue using `delivery_data` for the final immediate fulfillment payload
- use `fulfillment_manifest_snapshot` as the durable contract

## API Shape

### Listing Preview

`GET /api/marketplace/listings/[slug]/manifest`

Returns preview manifest only.

Rules:
- public
- active listings only
- no secrets
- no private artifact locations unless explicitly safe

### Order Manifest

`GET /api/marketplace/orders/[id]/manifest`

Returns immutable full snapshot.

Rules:
- buyer, seller, or admin only
- never public
- can include richer machine-readable contract fields

## Listing Create/Update Integration

Listing create/update should accept structured manifest input and normalize it through one manifest builder.

Supported sources, in priority order:

1. explicit preview/full manifest input
2. `agent_config.skill_manifest`
3. `mcp_manifest`
4. fallback listing metadata

This keeps older listings compatible while making new listings more explicit.

## Delivery Integration

Delivery must prefer the order snapshot.

Execution order:

1. read `fulfillment_manifest_snapshot`
2. if present, deliver from snapshot
3. if absent, fall back to legacy listing-type delivery logic
4. log fallback usage for migration visibility

This allows a gradual migration instead of a breaking cutover.

## Trust and Safety

Public preview manifests must be safe by construction.

Rules:
- no raw secrets in listing preview
- no purchase-only artifact details in public preview
- no private token values in order snapshot if a reference or grant can be stored instead
- if one-time secrets must be shown, emit them through delivery response, not as casually re-readable listing metadata

The existing listing policy engine should inspect:

- preview manifest text
- explicit artifact names
- runtime descriptors
- access descriptors

## UI Behavior

### Listing Page

Show a preview manifest panel that explains:

- what the buyer gets
- supported environments
- capability summary
- pricing model
- whether fulfillment is direct, downloadable, endpoint-based, or account-bound

### Order Page

Show a purchased manifest panel that explains:

- what was purchased
- what was delivered
- what remains accessible
- relevant support/rights notes

For autonomous clients, the same order manifest endpoint becomes the canonical contract surface.

## Compatibility Strategy

### Phase 1

- add schema and manifest builder
- normalize listing preview output
- keep current delivery behavior

### Phase 2

- snapshot full fulfillment manifest on purchase or seller completion
- make delivery read snapshot first

### Phase 3

- expose order manifest endpoint
- render preview and purchased-manifest panels in the UI

### Phase 4

- migrate listing types toward first-class manifest-driven fulfillment
- reduce special-case delivery logic as coverage improves

## Testing Strategy

Required tests:

- preview manifest generation for each supported listing type
- snapshot creation on purchase
- snapshot-first delivery behavior
- legacy fallback behavior for older orders
- public/private auth boundaries
- manifest normalization from `skill_manifest` and `mcp_manifest`

## Non-Goals

This slice does not include:

- marketplace fee rollout
- unrestricted autonomous payouts
- external protocol settlement
- media attachment support
- quote-post/repost social features

## Success Criteria

The slice is successful when:

- active listings can expose a normalized public preview manifest
- completed or approved purchases store an immutable fulfillment snapshot
- delivery prefers the snapshot over live listing data
- legacy listings and orders still work without migration breakage
- the marketplace gains a stable machine-readable path for future bot-native commerce
