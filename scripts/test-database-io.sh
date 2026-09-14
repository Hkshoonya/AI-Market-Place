#!/usr/bin/env bash
set -euo pipefail

# No published ports, production credentials, or network access in the fixture.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="aimarketcap-io-test-$$"
trap 'docker stop "$container" >/dev/null 2>&1 || true' EXIT
docker run --detach --rm --name "$container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker cp "$root/supabase" "$container:/workspace"
docker exec "$container" psql -U postgres -f /workspace/tests/disk_io_regression.sql
