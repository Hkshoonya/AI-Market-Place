# Schema Bootstrap

The committed migration history before `020_*` is not sufficient to replay a clean database from empty state.

Known issue:
- `001-015` contain out-of-order assumptions about objects such as `data_sources`, `model_news`, `model_snapshots`, and several marketplace/community tables.
- The forward repair migrations (`020_*` and later) are intended for live databases and staging copies that already have the historical schema shape.

## Production-safe rule

For live environments:
1. Apply migrations in order on top of the existing database.
2. Do not rewrite already-applied historical migrations in production.
3. Use the forward repair migrations to normalize missing tables, policies, and RPCs.

## New environment bootstrap

For a brand-new environment, do not rely on replaying `001-015` from empty state.

Use this flow instead:
1. Create a staging database from a repaired production clone or a known-good staging snapshot.
2. Export a baseline schema from that repaired database.
3. Initialize new environments from the baseline schema.
4. Apply forward migrations created after the baseline.

## Why this exists

This repository currently needs two different guarantees:
- forward-only safety for the deployed production database
- deterministic bootstrap for new environments

Those are related, but they are not the same problem. The forward repair migrations solve the first one. A baseline schema is still required for the second.
