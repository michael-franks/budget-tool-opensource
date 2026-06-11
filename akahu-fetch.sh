#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# akahu-fetch.sh — Called by /etc/cron.d/budget-tracker
# Triggers the server to fetch latest transactions from Akahu
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

PORT="${PORT:-3000}"
LOG_TAG="akahu-fetch"

log() { logger -t "$LOG_TAG" "$@"; echo "$(date -Iseconds) $@"; }

# Wait up to 10s for the server to be reachable (in case cron fires before boot completes)
for i in $(seq 1 10); do
  if curl -sf "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 10 ]; then
    log "ERROR: Server not reachable on port ${PORT} after 10s"
    exit 1
  fi
  sleep 1
done

# Trigger fetch
RESPONSE=$(curl -sf -X POST "http://127.0.0.1:${PORT}/api/fetch" \
  -H "Content-Type: application/json" \
  --max-time 120 2>&1) || {
    log "ERROR: Fetch request failed: ${RESPONSE}"
    exit 1
  }

# Parse result
OK=$(echo "$RESPONSE" | node -pe 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).ok' 2>/dev/null || echo "false")
NEW=$(echo "$RESPONSE" | node -pe 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).newCount' 2>/dev/null || echo "?")
TOTAL=$(echo "$RESPONSE" | node -pe 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).totalCount' 2>/dev/null || echo "?")

if [ "$OK" = "true" ]; then
  log "OK: ${NEW} new transactions (${TOTAL} total)"
else
  log "ERROR: Server returned ok=false — ${RESPONSE}"
  exit 1
fi
