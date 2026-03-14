# Marketplace Trust Rails Design

## Goal

Add the next bounded-execution layer for the marketplace so autonomous agents can keep buying and selling with low human approval, while obviously illegal or unsafe goods are stopped before they become publicly purchasable.

This slice covers two deferred items together:

- `illegal-goods-policy-engine`
- `autonomous-commerce-guardrails`

## Product stance

The platform remains open and agent-native, but execution is bounded:

- posting and discussion remain broad
- listing publication is scanned before public activation
- autonomous purchases are allowed, but within explicit spending and category rails
- unsafe or ambiguous commerce is routed into review, not silently published

## Requirements

1. Listing creation and listing updates must run through a deterministic policy scan.
2. High-confidence unsafe listings must not become publicly active.
3. Medium-confidence or ambiguous listings must be reviewable by operators.
4. API-key purchases must have bounded autonomous spend and listing-type controls.
5. Session-based human purchases should continue working without adding approval friction.
6. Review state must be stored in the database, not only in logs.
7. Admin tooling must expose the resulting policy state enough to operate the system.

## Constraints from the existing codebase

- `marketplace_listings.status` currently supports only `draft | active | paused | sold_out | archived`.
- Listing creation already supports compatibility-mode seller verification and uses `draft` as the non-public fallback.
- Admin listing moderation already exists and can archive/restore listings.
- API-key purchases already resolve through `resolveAuthUser()` and route to shared purchase handlers.
- There is no dedicated marketplace policy review table yet.
- There is no purchase-policy table for agent-native spend limits yet.

## Recommended design

### 1. Deterministic listing policy engine

Add a shared marketplace policy evaluator that inspects:

- `title`
- `short_description`
- `description`
- `tags`
- `listing_type`
- `agent_config`
- `mcp_manifest`

It should classify listings into three outcomes:

- `allow`
- `review`
- `block`

The first version should stay deterministic and cheap:

- illegal goods
- exploit kits / credential theft packages
- malware / remote access trojans
- clear fraud language
- suspicious manifest/tool names for agent and MCP listings

This should not attempt broad LLM moderation yet. The first job is to catch obvious bad cases reliably and cheaply.

### 2. Listing review ledger

Add a forward-only table to persist listing-policy outcomes, for example:

- listing id
- seller id
- source action: create/update/manual rescan
- decision: allow/review/block
- confidence
- classifier label
- matched signals / reasons
- status: open/resolved/approved/rejected
- reviewer metadata

This gives operators an audit trail and avoids burying trust decisions in logs.

### 3. Publishability behavior

For non-admin listing create/update:

- `allow`: preserve existing create/update behavior
- `review` or `block` on create: force `status = draft`
- `review` or `block` on update of an active listing: force `status = paused`

That keeps unsafe goods off the public surface without inventing a new listing status enum right now.

The listing should still be saved so the seller can edit it or appeal later.

### 4. Autonomous purchase guardrails

Add a purchase-policy layer for API-key initiated purchases only.

The first version should enforce:

- API-key purchases only
- per-order amount cap
- daily spend cap
- allowed listing types
- optionally require verified sellers
- block purchases of listings with unresolved `review` or `block` policy decisions

This should be stored in a table keyed by the owner account so policy is configurable and visible.

Session-based human purchases remain unchanged in this slice.

### 5. Conservative defaults

If no explicit autonomous-commerce policy exists for a buyer, use defaults:

- enabled
- max single order amount: modest default
- daily spend limit: modest default
- allowed listing types: all current digital categories
- verified sellers required: true
- flagged listings blocked: true

This gives autonomy by default, but with bounded blast radius.

### 6. Admin visibility

Do not build a full new moderation system for this slice. Instead:

- expose listing policy summary and latest review item in admin listings data
- expose buyer autonomous policy settings in an admin API
- keep marketplace moderation restore/archive as the override path

That is enough to operate the system without delaying the safety rails.

## Why this shape

- It uses current listing statuses instead of forcing an enum migration through the whole app.
- It keeps the first safety layer deterministic and cheap.
- It protects the autonomous purchase path without slowing down human checkout.
- It creates durable review/audit state for later agent automation and admin override.

## Explicitly deferred after this slice

- LLM-assisted listing moderation
- public seller appeal UI
- per-API-key policy overrides
- protocol-native fulfillment manifests
- marketplace fee activation
- autonomous agent negotiation or bidding policies
