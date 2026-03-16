#!/usr/bin/env bash
# AI Market Cap - Cron Job Trigger
#
# This script is called by system crontab to trigger API cron endpoints.
# Usage:
#   ./cron-jobs.sh <job-name>
#   ./cron-jobs.sh sync-source <source-slug>
#
# Install crontab entries (run: crontab -e):
#
#   # AI Market Cap cron jobs
#   0 */2 * * *   /opt/aimc/scripts/cron-jobs.sh sync-t1
#   0 */4 * * *  /opt/aimc/scripts/cron-jobs.sh sync-t2
#   0 */8 * * *     /opt/aimc/scripts/cron-jobs.sh sync-t3
#   0 0 * * *     /opt/aimc/scripts/cron-jobs.sh sync-t4
#   */5 * * * *   /opt/aimc/scripts/cron-jobs.sh auctions
#   30 */2 * * *  /opt/aimc/scripts/cron-jobs.sh pipeline
#   0 9 * * *     /opt/aimc/scripts/cron-jobs.sh code-quality
#   0 10 * * 1    /opt/aimc/scripts/cron-jobs.sh ux-monitor
#   15 */4 * * *  /opt/aimc/scripts/cron-jobs.sh verifier
#   45 */2 * * *  /opt/aimc/scripts/cron-jobs.sh compute-scores

set -euo pipefail

# Use the public Railway/Cloudflare URL when the cron host is separate from the app host.
BASE_URL="${AIMC_BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:?Set CRON_SECRET environment variable}"
LOG_DIR="/var/log/aimc"
mkdir -p "$LOG_DIR"

call_cron() {
  local path="$1"
  local name="$2"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  echo "[$timestamp] Starting: $name ($path)" >> "$LOG_DIR/cron.log"

  local http_code
  http_code=$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 600 \
    -H "Authorization: Bearer $CRON_SECRET" \
    "${BASE_URL}${path}")

  echo "[$timestamp] Finished: $name -> HTTP $http_code" >> "$LOG_DIR/cron.log"

  if [ "$http_code" != "200" ] && [ "$http_code" != "202" ]; then
    echo "[$timestamp] ERROR: $name returned $http_code" >> "$LOG_DIR/cron-errors.log"
  fi
}

if [ "${1:-}" = "sync-source" ]; then
  SOURCE_SLUG="${2:-}"
  if [ -z "$SOURCE_SLUG" ]; then
    echo "Usage: $0 sync-source <source-slug>"
    exit 1
  fi
  call_cron "/api/cron/sync?source=${SOURCE_SLUG}" "Single Source Sync (${SOURCE_SLUG})"
  exit 0
fi

case "${1:-}" in
  sync-t1)        call_cron "/api/cron/sync?tier=1"          "Tier 1 Sync" ;;
  sync-t2)        call_cron "/api/cron/sync?tier=2"          "Tier 2 Sync" ;;
  sync-t3)        call_cron "/api/cron/sync?tier=3"          "Tier 3 Sync" ;;
  sync-t4)        call_cron "/api/cron/sync?tier=4"          "Tier 4 Sync" ;;
  auctions)       call_cron "/api/cron/auctions"             "Auction Settlement" ;;
  pipeline)       call_cron "/api/cron/agents/pipeline"      "Pipeline Agent" ;;
  code-quality)   call_cron "/api/cron/agents/code-quality"  "Code Quality" ;;
  ux-monitor)     call_cron "/api/cron/agents/ux-monitor"    "UX Monitor" ;;
  verifier)       call_cron "/api/cron/agents/verifier"      "Verifier Agent" ;;
  compute-scores) call_cron "/api/cron/compute-scores"       "Compute Scores" ;;
  *)
    echo "Usage: $0 {sync-t1|sync-t2|sync-t3|sync-t4|auctions|pipeline|code-quality|ux-monitor|verifier|compute-scores}"
    echo "       $0 sync-source <source-slug>"
    exit 1
    ;;
esac
