#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="aimc-profile-privacy-test-$$"
trap 'docker stop "$container" >/dev/null 2>&1 || true' EXIT
docker run --detach --rm --name "$container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
ready=false
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then docker logs "$container"; exit 1; fi
docker cp "$root/supabase" "$container:/workspace"
docker exec "$container" psql -h 127.0.0.1 -U postgres -f /workspace/tests/profile_privacy_regression.sql
