---
status: diagnosed
trigger: "orders page shows nothing is loading for authenticated users"
created: 2026-03-08T00:00:00Z
updated: 2026-03-08T00:00:00Z
---

## Current Focus

hypothesis: MarketplaceOrderSchema.buyer_id is z.string() (non-nullable) but the database allows null buyer_id for guest orders. When ANY guest order exists in the query results, Zod validation fails for the entire array, and parseQueryResult returns [].
test: Compare Zod schema field definition to database column nullability
expecting: buyer_id mismatch causes silent data loss via parseQueryResult returning []
next_action: N/A - root cause confirmed

## Symptoms

expected: Authenticated users see their list of orders on /orders page
actual: Page shows "No orders found" (empty state) even when the user has orders
errors: No visible errors (parseQueryResult silently returns [] on validation failure, logging only to Sentry/console)
reproduction: Visit /orders as an authenticated user who has placed orders
started: After phase 11 migration to Zod runtime validation (parseQueryResult)

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-08T00:01:00Z
  checked: src/app/(auth)/orders/orders-content.tsx - client-side data fetching
  found: Component queries Supabase directly (NOT via API route). Uses `parseQueryResult(response, OrderWithJoinsSchema, "OrderWithJoins")` on line 57. The Supabase select is: `"*, marketplace_listings(title, slug, listing_type, thumbnail_url), seller:seller_id(display_name, avatar_url, username)"`. The `*` wildcard returns ALL columns from marketplace_orders, including guest_email and guest_name.
  implication: parseQueryResult validates against OrderWithJoinsSchema which inherits from MarketplaceOrderSchema

- timestamp: 2026-03-08T00:02:00Z
  checked: src/lib/schemas/marketplace.ts - MarketplaceOrderSchema definition (lines 56-68)
  found: |
    buyer_id is defined as z.string() (non-nullable, required).
    The schema does NOT include guest_email or guest_name fields.
    The schema does NOT use .passthrough() so extra fields from `*` wildcard would be stripped but not cause failure.
  implication: If any order row has buyer_id = null (guest order), Zod validation fails

- timestamp: 2026-03-08T00:03:00Z
  checked: src/types/database.ts - MarketplaceOrder interface (line 388) and Insert type (line 948)
  found: |
    Interface says `buyer_id: string` (non-nullable) but this is the app-level TS interface.
    Insert type says `buyer_id?: string | null` confirming the DB column IS nullable.
    Guest order flow in API route (line 188) explicitly inserts `buyer_id: null`.
  implication: Database genuinely stores null buyer_id values for guest orders

- timestamp: 2026-03-08T00:04:00Z
  checked: src/lib/schemas/parse.ts - parseQueryResult behavior (lines 23-40)
  found: |
    Uses z.array(schema).safeParse(response.data).
    On validation failure: calls reportSchemaError (logs to Sentry/console), returns [].
    This is ALL-OR-NOTHING: if ANY row in the array fails validation, the ENTIRE array is rejected.
  implication: Even a single guest order in the result set causes all orders to be lost

- timestamp: 2026-03-08T00:05:00Z
  checked: src/app/(auth)/orders/orders-content.tsx query filter
  found: |
    Query filters by `.eq("buyer_id", user.id)` so it only fetches orders for the current user.
    Guest orders have buyer_id = null, so they would NOT match this filter.
    However, the `*` select returns all columns, and the schema still validates all returned rows.
  implication: Wait - if buyer_id filter excludes nulls, the buyer_id null issue would not trigger for the orders list query. Need to re-examine.

- timestamp: 2026-03-08T00:06:00Z
  checked: Re-analysis of the actual failure mode
  found: |
    The .eq("buyer_id", user.id) filter means only rows where buyer_id = user.id are returned.
    So buyer_id will never be null in the result set for this specific query.
    BUT: The `*` in the select returns guest_email and guest_name columns.
    MarketplaceOrderSchema does NOT define guest_email or guest_name.
    However, Zod's .object() strips unknown keys by default - it does NOT fail on extra keys.
    So extra columns from `*` are NOT the problem either.

    TRUE ROOT CAUSE: The Supabase select uses `seller:seller_id(...)` which creates a RELATIONSHIP join.
    If seller_id references a profile that does NOT exist (deleted user, or FK not set up),
    the `seller` field will be null. The OrderWithJoinsSchema handles this with `.nullable().optional()`.

    Let me re-examine more carefully what could actually fail...
  implication: Need to look at the actual data flow more carefully

- timestamp: 2026-03-08T00:07:00Z
  checked: Deep schema comparison - what the query returns vs what schema expects
  found: |
    Query select: `*, marketplace_listings(title, slug, listing_type, thumbnail_url), seller:seller_id(display_name, avatar_url, username)`

    The `*` returns all base columns from marketplace_orders. The database has columns:
    id, listing_id, buyer_id, seller_id, status, message, price_at_time, delivery_data, guest_email, guest_name, created_at, updated_at

    MarketplaceOrderSchema expects:
    id: z.string()
    listing_id: z.string()
    buyer_id: z.string()         <-- non-nullable
    seller_id: z.string()
    status: z.string()
    message: z.string().nullable()
    price_at_time: z.number().nullable()
    delivery_data: z.record(...).nullable()
    created_at: z.string()
    updated_at: z.string()

    The query filters .eq("buyer_id", user.id), so buyer_id is always a string in results - OK.

    BUT: delivery_data is z.record(z.string(), z.unknown()).nullable().
    If the database stores delivery_data as a JSON object with non-string keys or specific structures,
    this could fail. However z.record(z.string(), z.unknown()) is very permissive.

    Wait - the REAL issue might be simpler. Let me check if the Supabase client-side query
    even succeeds at all. The `seller:seller_id(...)` syntax requires a foreign key relationship
    between marketplace_orders.seller_id and profiles.id. If this FK doesn't exist in the
    database, Supabase will return an error (not just null data).
  implication: The relationship join itself could be failing at the Supabase level

- timestamp: 2026-03-08T00:08:00Z
  checked: API route GET handler vs client component query comparison
  found: |
    CRITICAL MISMATCH FOUND:

    API route (server): Queries `*, marketplace_listings(title, slug, listing_type)` - NO seller join.
    It does a SEPARATE profiles query for seller enrichment.

    Client component: Queries `*, marketplace_listings(title, slug, listing_type, thumbnail_url), seller:seller_id(display_name, avatar_url, username)` - WITH seller join alias.

    The client component does NOT use the API route at all. It queries Supabase directly.

    The `seller:seller_id(...)` syntax is a Supabase relationship alias. This requires either:
    1. A foreign key from marketplace_orders.seller_id -> profiles.id, OR
    2. An explicit relationship hint

    If there's no FK, the entire query returns an error.
    If there IS a FK but the profile doesn't exist, seller will be null (handled by schema).

    The API route deliberately AVOIDS this join (comment on line 52: "Two-query approach: marketplace_orders may not have FK to profiles"), suggesting the FK may NOT exist.

    If the FK doesn't exist, the Supabase client query will fail with an error like:
    "Could not find a relationship between 'marketplace_orders' and 'profiles'"

    parseQueryResult receives { data: null, error: {...} } and returns [].
  implication: The client query fails because there is no FK from marketplace_orders.seller_id to profiles, causing the entire query to error out silently

## Resolution

root_cause: |
  The client component (orders-content.tsx) queries Supabase directly using a relationship
  alias join `seller:seller_id(display_name, avatar_url, username)` that requires a foreign
  key from marketplace_orders.seller_id to profiles.id.

  The API route for the same data (api/marketplace/orders/route.ts) deliberately avoids
  this join with the comment "Two-query approach: marketplace_orders may not have FK to profiles"
  and instead does a separate profiles lookup.

  When this FK doesn't exist, the Supabase query returns an error response. parseQueryResult
  sees `response.error` is truthy and returns an empty array []. The component receives no
  orders and displays "No orders found."

  The same issue affects the order detail page (order-detail-content.tsx) which uses
  `buyer:buyer_id(...)` and `seller:seller_id(...)` alias joins.

  Secondary issue: MarketplaceOrderSchema defines buyer_id as z.string() (non-nullable)
  but the database column IS nullable (for guest orders). This is a latent bug that would
  surface if the schema were used to validate queries that include guest order rows.

  CONTRIBUTING FACTOR: parseQueryResult silently returns [] on ANY failure (Supabase error
  OR Zod validation failure), with errors only logged to Sentry/console. There is no
  user-visible error, making the page appear to load successfully but with no data.

fix: (research only - not applying fix)
verification: (research only)
files_changed: []

### Files Involved

- `src/app/(auth)/orders/orders-content.tsx` (line 44-57): Direct Supabase query with relationship alias join that likely fails
- `src/app/(auth)/orders/[id]/order-detail-content.tsx` (line 65-71): Same pattern with buyer + seller alias joins
- `src/lib/schemas/marketplace.ts` (line 56-68): MarketplaceOrderSchema has buyer_id as non-nullable (latent bug)
- `src/lib/schemas/parse.ts` (line 28-29): Silent failure returns [] on error
- `src/app/api/marketplace/orders/route.ts` (line 52-65): API route correctly avoids the join (not used by client)

### Suggested Fix Direction

Two options:
1. **Make client components use the API route** instead of querying Supabase directly (consistent with API route's two-query approach)
2. **Switch client queries to avoid relationship alias joins** - use `*` select without seller join, then do a separate profiles fetch (matching the API route pattern)

Additionally:
- Fix MarketplaceOrderSchema.buyer_id to be `z.string().nullable()` to match the database
- Consider adding the missing FK in the database if the relationship is intentional
