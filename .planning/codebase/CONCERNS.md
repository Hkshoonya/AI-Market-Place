# Codebase Concerns

**Analysis Date:** 2026-03-02

## Tech Debt

**Type Safety (TypeScript):**
- Issue: Excessive use of `as any` and `@typescript-eslint/no-explicit-any` suppressions throughout codebase
- Files: `src/app/page.tsx`, `src/app/sitemap.ts`, `src/app/compare/compare-client.tsx`, `src/lib/marketplace/auctions/english.ts`, `src/lib/payments/wallet.ts`, `src/lib/data-sources/model-matcher.ts`, `src/components/watchlists/watchlist-card.tsx`, `src/app/(auth)/watchlists/[id]/watchlist-detail-content.tsx`, `src/lib/middleware/api-paywall.ts`
- Impact: Reduces static type checking benefits, increases runtime error risk, makes refactoring unsafe. Appears in at least 50+ locations across codebase.
- Fix approach:
  1. Generate proper TypeScript types from Supabase schema using `supabase gen types typescript` instead of manual type definitions
  2. Replace `any` with specific union types or interfaces
  3. Use generics for reusable admin client patterns instead of casting
  4. Create shared types file for Supabase client shapes

**Manual Type Definitions vs Auto-Generated:**
- Issue: `src/types/database.ts` contains 1058 lines of manually maintained type definitions instead of auto-generated types
- Files: `src/types/database.ts`
- Impact: Types get out of sync with actual database schema, new columns silently fail to type-check, maintenance burden
- Fix approach: Replace manual types with `supabase gen types typescript` command, integrate into build process

**Inconsistent Error Handling:**
- Issue: Mix of try-catch, error objects, success/error tuple patterns, and no error handling in client components
- Files: `src/lib/marketplace/auctions/english.ts`, `src/app/api/webhooks/chain-deposits/route.ts`, `src/lib/payments/chains/evm.ts`, `src/lib/payments/chains/solana.ts`, `src/components/marketplace/purchase-button.tsx`, `src/app/(marketplace)/dashboard/seller/listings/[slug]/edit/edit-listing-content.tsx`
- Impact: Inconsistent error messages to users, errors sometimes logged but not handled, silent failures in async operations
- Fix approach:
  1. Create unified error handling pattern with `ApiError` wrapper
  2. Standardize on Result<T, E> or error-throwing approach
  3. Add error boundaries to all async operations in client components
  4. Ensure all external API calls have try-catch with user-facing error messages

## Known Bugs

**Auction Timer Race Condition:**
- Symptoms: Dutch auction prices may show stale values or desynchronize from server during rapid refreshes
- Files: `src/app/(marketplace)/marketplace/auctions/[id]/auction-detail-content.tsx` (lines 593-647)
- Trigger: User navigates to auction detail page, timer updates run at 1s interval while price refreshes at 10s interval, network latency causes discrepancies
- Workaround: Refresh page manually to resync timer with current price
- Fix approach: Consolidate timer and price fetch into single 10s interval, compute elapsed time locally from single server timestamp rather than two separate intervals

**Previous Bid Refund Silent Failure:**
- Symptoms: If refunding previous bidder's escrow fails during bid placement, the bid is still recorded but previous bidder's funds are locked
- Files: `src/lib/marketplace/auctions/english.ts` (lines 125-133)
- Cause: Refund error is logged but bid still succeeds, creating stuck escrow holds
- Fix approach: Either fail the entire bid transaction or add async cleanup job for stuck escrow holds, plus alerting for manual intervention

**Escrow Transaction Partial Failure:**
- Symptoms: Bid escrow is held but later fails to record in database, leaving funds locked indefinitely
- Files: `src/lib/marketplace/auctions/english.ts` (lines 151-159)
- Cause: No transaction boundaries between escrow hold and bid insertion
- Fix approach: Use database transaction wrapper, or implement compensating transaction (refund escrow) if bid insert fails

## Security Considerations

**Supabase Admin Client Bypass:**
- Risk: Admin client created with `createAdminClient()` bypasses all RLS (Row Level Security) policies
- Files: `src/lib/payments/wallet.ts`, `src/lib/marketplace/auctions/english.ts`, `src/lib/marketplace/auctions/dutch.ts`, `src/app/api/webhooks/chain-deposits/route.ts`, `src/app/api/cron/auctions/route.ts`
- Current mitigation: Routes are protected by bearer token authentication (CRON_SECRET) and limited to internal cron/webhook endpoints
- Recommendations:
  1. Add explicit authorization checks before sensitive operations (verify user owns wallet, bid belongs to user, etc.)
  2. Document which operations legitimately need admin bypass
  3. Consider creating intermediate RLS-enforcing policies for common operations instead of full admin bypass
  4. Add audit logging for all admin client mutations

**Insufficient Input Validation:**
- Risk: User input (bid amounts, prices, form fields) not consistently validated before database operations
- Files: `src/components/marketplace/purchase-button.tsx`, `src/lib/marketplace/auctions/english.ts` (line 76-84 has some validation but not comprehensive), `src/app/api/marketplace/auctions/route.ts`
- Current mitigation: Basic type checking via TypeScript at compile-time, some runtime checks for critical paths
- Recommendations:
  1. Use Zod schemas on every public API endpoint for request validation
  2. Validate price/amount constraints on client before submission
  3. Validate authorization (user ownership) before processing mutations
  4. Add rate limiting to prevent bid spam/auction manipulation

**API Key Storage (Client-Side):**
- Risk: API keys stored in browser localStorage for authenticated API calls
- Files: Browser local storage in API key management pages
- Current mitigation: Keys are scoped and rotatable, but stored unencrypted
- Recommendations:
  1. Use httpOnly cookies for session tokens instead of localStorage
  2. Implement token refresh pattern with short-lived access tokens
  3. Never expose secret keys to client, use proxy pattern
  4. Add key expiration/rotation enforcement

**CORS and CSRF:**
- Risk: No explicit CSRF token validation visible in forms
- Files: API routes for mutations (`src/app/api/marketplace/*`)
- Current mitigation: POST-only endpoints, browser CORS protection
- Recommendations:
  1. Add explicit CSRF token validation on state-changing operations
  2. Implement SameSite cookie policy enforcement
  3. Validate referer/origin headers on sensitive endpoints

## Performance Bottlenecks

**Large Component Files:**
- Problem: Several large client components making excessive re-renders and managing complex state
- Files:
  - `src/app/(marketplace)/marketplace/auctions/[id]/auction-detail-content.tsx` (985 lines)
  - `src/app/(catalog)/models/[slug]/page.tsx` (881 lines)
  - `src/app/(marketplace)/dashboard/seller/earnings/seller-earnings-content.tsx` (838 lines)
  - `src/app/(admin)/admin/listings/[slug]/edit/page.tsx` (527 lines)
- Cause: Multiple concerns (data fetching, form handling, display logic) in single component
- Improvement path:
  1. Break large components into 200-400 line chunks with clear responsibilities
  2. Extract form logic into custom hooks
  3. Separate data fetching concerns from display concerns
  4. Memoize expensive calculations and table renders

**Multiple Polling Intervals:**
- Problem: Client components use multiple `setInterval` calls for different data (timer, price updates, message polling)
- Files: `src/app/(marketplace)/marketplace/auctions/[id]/auction-detail-content.tsx` (lines 593-647), `src/app/(auth)/orders/[id]/order-detail-content.tsx` (line 100)
- Cause: Each concern updates on its own schedule without coordination
- Impact: Network overhead, battery drain on mobile, unnecessary re-renders
- Improvement path:
  1. Consolidate multiple intervals into single request with multiplexed responses
  2. Implement WebSocket connection for real-time updates instead of polling
  3. Add exponential backoff for stale data
  4. Implement aggressive caching with stale-while-revalidate headers

**No Test Coverage:**
- Problem: Zero automated tests across entire codebase
- Files: No `*.test.ts` or `*.spec.ts` files found
- Impact: Refactoring is high-risk, regressions slip through, confidence in changes is low
- Improvement path:
  1. Install testing framework (Jest or Vitest recommended)
  2. Start with critical paths: auth, payments, marketplace transactions
  3. Aim for 50%+ coverage of payment/auction logic (highest risk areas)
  4. Add E2E tests for user flows (bid, purchase, auction settlement)

**N+1 Query Pattern:**
- Problem: Data fetching operations may load parent records then iterate to fetch children
- Files: Data source adapters in `src/lib/data-sources/adapters/`, fetch operations in page components
- Impact: Excessive database queries, slow sync jobs, slow data loading
- Improvement path:
  1. Use Supabase joins (select with nested relations) instead of separate queries
  2. Batch API calls using Promise.all() where possible
  3. Add query result caching layer for frequently accessed data
  4. Monitor slow queries using database logs

**Client-Side Data Matching:**
- Problem: Model name matching done in memory for every request/page load
- Files: `src/lib/data-sources/model-matcher.ts` (416 lines, rebuilds lookup every sync)
- Impact: Slow startup, duplicated work across instances, memory usage
- Improvement path:
  1. Pre-compute model aliases at sync time, store in database
  2. Use database full-text search or trigram indexes for name matching
  3. Cache lookup table with TTL in Redis if available

## Fragile Areas

**Blockchain Payment Integration:**
- Files: `src/lib/payments/chains/solana.ts`, `src/lib/payments/chains/evm.ts`, `src/app/api/webhooks/chain-deposits/route.ts`
- Why fragile:
  - External blockchain network calls can fail transiently
  - Deposit detection logic depends on exact contract event signatures
  - No idempotency keys prevent double-crediting on retries
  - Escrow system has multiple coordinated state transitions
- Safe modification:
  1. Add comprehensive integration tests with mock blockchain responses
  2. Implement idempotent operations using tx_hash deduplication (already done correctly in line 152-157)
  3. Add monitoring/alerting for stuck deposits and failed settlements
  4. Create manual intervention tools for edge cases
- Test coverage: No tests found

**Escrow and Payment Settlement:**
- Files: `src/lib/payments/wallet.ts`, `src/lib/marketplace/auctions/english.ts`
- Why fragile:
  - Multiple async operations must coordinate (hold → insert bid → refund previous)
  - Database constraints are implicit, not enforced by code
  - No transaction boundaries between related operations
  - Error in one step can leave system in inconsistent state
- Safe modification:
  1. Use Supabase transactions or wrapped procedures
  2. Add pre-condition checks before starting settlement
  3. Implement settlement idempotency (safe to retry)
  4. Add comprehensive logging of every state transition
- Test coverage: No tests found

**Data Source Sync Adapters:**
- Files: 27 adapter files in `src/lib/data-sources/adapters/` (largest: openai-models.ts 767 lines, replicate.ts 653 lines)
- Why fragile:
  - Each adapter has unique error handling strategy
  - External APIs may return different formats/errors without notice
  - Fallback to static data may provide stale information
  - No validation that imported data meets schema requirements
- Safe modification:
  1. Create adapter test harness with mock API responses
  2. Standardize error handling across all adapters
  3. Add schema validation before upserting
  4. Implement dry-run mode to preview changes
- Test coverage: No tests found

**Quality Score Calculation:**
- Files: `src/lib/scoring/quality-calculator.ts` (410 lines of complex weighting logic)
- Why fragile:
  - Complex multi-factor calculation prone to off-by-one errors
  - Category-specific weight profiles may not apply to new model types
  - Proxy signals (provider average, parameter count) can be misleading
  - No validation that output scores are reasonable (0-100 range)
- Safe modification:
  1. Add comprehensive unit tests for scoring functions
  2. Create regression tests with known model scores
  3. Add bounds checking and logging of edge cases
  4. Document weighting rationale clearly
- Test coverage: No tests found

## Scaling Limits

**Database Connection Pool:**
- Current capacity: Default Supabase connection pool (assumed ~10 connections)
- Limit: Under high concurrent load (100+ simultaneous requests), connection pool exhaustion will cause timeouts
- Scaling path:
  1. Increase connection pool size in Supabase project settings
  2. Implement connection pooling at application level (PgBouncer)
  3. Add request queuing to prevent thundering herd

**Real-Time Polling Scalability:**
- Current capacity: Polling implemented at client level with 15-30s intervals per user
- Limit: 1000+ concurrent users polling different endpoints will cause N×(requests/minute) load
- Scaling path:
  1. Replace polling with Supabase Realtime subscriptions (WebSocket)
  2. Implement server-sent events (SSE) for auction updates
  3. Add caching layer (Redis) for frequently accessed data

**Data Source Sync Jobs:**
- Current capacity: Sequential adapter execution in single cron job
- Limit: 27 adapters running sequentially will exceed timeout if any adapter is slow
- Scaling path:
  1. Parallelize adapter execution with Promise.all()
  2. Implement queue system (Bull, RabbitMQ) for retry logic
  3. Add circuit breaker pattern to skip failing adapters without blocking others

**Marketplace Transaction Volume:**
- Current capacity: Single Supabase instance, no sharding
- Limit: High bid/auction activity could exceed database I/O limits
- Scaling path:
  1. Implement read replicas for reporting queries
  2. Add caching layer for model/listing metadata
  3. Use event sourcing for audit trail if transaction volume grows

## Dependencies at Risk

**Three.js (Web Graphics):**
- Risk: Heavy dependency (183.1 version, 3D rendering), used for marketplace/product visualization
- Package: `three@^0.183.1`
- Impact: Large bundle size, may cause performance issues on low-end devices
- Migration plan:
  1. Lazy-load Three.js only when needed
  2. Consider alternatives like Babylon.js or use simpler WebGL solutions
  3. Profile bundle impact and set size budget

**Supabase (Critical):**
- Risk: Entire backend depends on Supabase (auth, database, RLS)
- Package: `@supabase/supabase-js@^2.98.0`, `@supabase/ssr@^0.8.0`
- Impact: Service outage blocks entire application
- Mitigation:
  1. Implement read-only cache layer for static data
  2. Add graceful degradation for critical features
  3. Set up monitoring/alerting for Supabase health

**Solana Web3 (Payment):**
- Risk: Blockchain integration for payments, version locking recommended
- Package: `@solana/web3.js@^1.98.4`
- Impact: Updates may introduce breaking changes in blockchain interactions
- Mitigation:
  1. Test thoroughly before updating
  2. Monitor release notes for breaking changes
  3. Pin to specific version if stability is critical

**Anthropic SDK (AI Features):**
- Risk: Used for agent/AI features, API may change
- Package: `@anthropic-ai/sdk@^0.78.0`
- Impact: Model deprecations, API changes, pricing changes
- Mitigation:
  1. Version pin or frequent testing against new versions
  2. Implement fallback models if primary model is deprecated
  3. Monitor Anthropic changelog

## Missing Critical Features

**Audit Logging:**
- Problem: No comprehensive audit trail for financial transactions (deposits, bids, settlements, withdrawals)
- Blocks: Fraud detection, dispute resolution, compliance reporting
- Impact: Cannot investigate discrepancies, cannot provide transaction history to users
- Fix approach:
  1. Create audit_log table with all transaction details
  2. Log before and after state for every mutation
  3. Implement queryable audit UI for admins

**Idempotency:**
- Problem: No idempotency key support for critical operations (bids, purchases, settlements)
- Blocks: Safe retries without double-charging, webhook reliability
- Impact: Retried requests may create duplicate charges or bids
- Fix approach:
  1. Add idempotency_key field to bid, purchase, withdrawal tables
  2. Check key before processing, return cached result if already executed
  3. Implement cleanup for stale idempotency keys (after 24h)

**Transaction Rollback / Compensation:**
- Problem: No mechanism to undo failed settlements or refund stuck transactions
- Blocks: User support escalations, correction of accounting errors
- Impact: Manual intervention required for failures, no self-service dispute resolution
- Fix approach:
  1. Implement transaction log with before/after snapshots
  2. Create admin tool to review and approve reversals
  3. Add compensating transaction execution (reverse payments, return bids)

**Rate Limiting:**
- Problem: No explicit API rate limiting visible in routes
- Blocks: DDoS protection, API abuse prevention
- Impact: API endpoints can be hammered, causing service degradation
- Fix approach:
  1. Implement token bucket rate limiting in `src/lib/rate-limit.ts` (file exists but may be incomplete)
  2. Apply to all public endpoints
  3. Return 429 status with Retry-After header

**WebSocket / Real-Time Updates:**
- Problem: Only polling-based updates for live data (auctions, bids, prices)
- Blocks: Live marketplace experience, low-latency trading
- Impact: Stale UI state, network overhead, battery drain
- Fix approach:
  1. Migrate to Supabase Realtime subscriptions
  2. Implement WebSocket server for marketplace updates
  3. Batch updates to reduce message overhead

**Email Notifications:**
- Problem: No email service integration visible
- Blocks: Order confirmations, bid notifications, marketplace alerts
- Impact: Users cannot receive important transaction notifications
- Fix approach:
  1. Integrate SendGrid or AWS SES
  2. Create notification templates for key events
  3. Add preference management in settings

## Test Coverage Gaps

**Payment and Auction Logic (HIGH PRIORITY):**
- What's not tested: Bid placement, escrow holds, auction settlement, refunds
- Files: `src/lib/marketplace/auctions/english.ts`, `src/lib/marketplace/auctions/dutch.ts`, `src/lib/payments/wallet.ts`
- Risk: Financial transactions with zero test coverage means bugs affect real money
- Approach:
  1. Write unit tests for bid validation logic
  2. Write integration tests for full auction flow (place bid → auction ends → settlement)
  3. Write tests for escrow edge cases (insufficient funds, concurrent bids, refund failures)

**Data Source Adapters (HIGH PRIORITY):**
- What's not tested: API parsing, error handling, data validation, fallback logic
- Files: `src/lib/data-sources/adapters/*.ts` (27 files)
- Risk: Bad data silently imported or sync jobs fail without notice
- Approach:
  1. Create adapter test harness with mock API responses
  2. Test both happy path and error cases
  3. Validate schema compliance before upsert
  4. Test fallback to static data

**Authentication and Authorization (MEDIUM PRIORITY):**
- What's not tested: Login flow, session management, RLS policy enforcement
- Files: `src/components/auth/auth-provider.tsx`, `src/app/(auth)/*`
- Risk: Authentication bypass or privilege escalation
- Approach:
  1. Test login/logout flows
  2. Test RLS policies with different user roles
  3. Test admin-only operations are blocked for regular users

**UI and Form Validation (LOW PRIORITY):**
- What's not tested: Form validation, error handling, loading states
- Files: Client components throughout
- Risk: User-facing bugs, poor error messages
- Approach:
  1. Add E2E tests for critical user flows
  2. Test form validation with invalid inputs
  3. Test error states and messaging

---

*Concerns audit: 2026-03-02*
