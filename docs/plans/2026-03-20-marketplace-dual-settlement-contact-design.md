# Marketplace Dual Settlement And Contact Design

## Goal

Shift the marketplace to a dual-mode commerce model where direct wallet settlement is the default public path, optional AI Market Cap assisted escrow remains available, first-phase platform messaging stays simple with `0% platform fee for now`, and marketplace/contact surfaces become substantially clearer, more visual, and operationally connected.

## Product Decisions

- Marketplace settlement supports two user-selectable modes:
  - `Direct wallet settlement`
  - `Assisted escrow via AI Market Cap`
- Direct settlement is the default recommendation and carries no platform fee.
- Assisted escrow remains available for users or agents that want mediated handling and platform-side tracking.
- Public messaging stays simple:
  - direct: user-controlled wallet settlement
  - assisted escrow: `0% platform fee for now`
- Internal fee policy must remain configurable so agents/admin automation can later switch assisted escrow from `0%` to `1.5%` without redesigning the public UX.
- Both humans and agents can use either mode. The platform offers the facility; the user chooses.

## Marketplace UX

### Hero

- Replace the current plain marketplace header with a more explanatory hero section.
- Use an animated Three.js visual showing users and AI agents converging on a handshake/exchange metaphor, with subtle block/network motion rather than a generic ambient effect.
- Hero copy must clearly explain:
  - the marketplace is for humans and agents
  - users can settle directly with their own wallets
  - AI Market Cap can optionally mediate through escrow
  - the platform currently charges `0% platform fee for now`

### Above-the-fold structure

- Introduce aligned explainer blocks before the listings grid:
  - `Direct Wallet Deals`
  - `Assisted Escrow`
  - `What We Track`
  - `0% Platform Fee For Now`
- These blocks should use consistent sizing/alignment and reduce the current visual looseness.
- The page should read as a guided decision surface first, listings discovery second.

### Repeated clarity across flows

- Listing detail, purchase, wallet, and related marketplace touchpoints should repeat the same policy model:
  - direct settlement keeps custody with the parties
  - assisted escrow routes through platform logic
  - tracking exists in either mode
  - public fee copy remains simple for now

## Contact And Communications

### Contact routing

- Listing/contact inquiries should notify the listed seller user directly.
- Admin should have audit/investigation visibility into these communications but should not receive noisy notifications for every sale or inquiry.
- Contact and marketplace communication flows should be connected rather than isolated.

### Communication storage

- Contact submissions and listing-specific inquiries should be stored in a way that supports:
  - seller notifications
  - future admin investigations
  - communication history
  - escalation/dispute review if needed later

### Verification and access

- Contact destinations should tie back to listed seller users where possible.
- Admin visibility should be read/investigation oriented, not alert-driven for every transaction.

## Backend Behavior

- Settlement mode must become an explicit, trackable concept in marketplace flows.
- Fee policy must be represented as configuration/rules, not hardcoded copy alone.
- Direct wallet mode should avoid making the platform the default holder of funds.
- Assisted escrow mode should preserve the current platform-mediated behavior and tracking path.
- Notifications should be generated for the seller on contact/inquiry events, while admin retains access through admin data surfaces rather than push-style spam.

## Hardening

- Add regression coverage for:
  - settlement mode behavior and fee-policy selection
  - contact routing to the listed seller
  - notification creation for inquiries
  - admin visibility without admin-notification spam
  - marketplace explanatory UI states
- Validate both component behavior and browser behavior before release.

## Rollout Order

1. Introduce backend settlement/contact/notification model changes.
2. Add tests for the new backend rules.
3. Update marketplace UI and contact UX.
4. Add/extend component and browser verification.
5. Run full test and build verification before push.
