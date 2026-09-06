#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="aimc-billing-test-${$}"
cleanup() { docker stop "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --rm --name "$container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker cp supabase/migrations/087_add_data_api_subscriptions.sql "$container:/tmp/087.sql"
docker cp supabase/migrations/090_repair_data_api_quota_conflict_target.sql "$container:/tmp/090.sql"
docker cp supabase/migrations/099_add_data_api_stripe_billing.sql "$container:/tmp/099.sql"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/data-api-billing.sql
