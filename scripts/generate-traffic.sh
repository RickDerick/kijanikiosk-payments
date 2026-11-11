#!/usr/bin/env bash
# Send payment traffic with a chosen share of invalid requests, to exercise the monitor.
# Usage: scripts/generate-traffic.sh <staging|production> <seconds> <invalid-percent>
#   scripts/generate-traffic.sh staging 150 0    # healthy traffic   -> monitor OK
#   scripts/generate-traffic.sh staging 150 20   # 20% failing       -> monitor ALERT
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_env "${1:-}"
SECONDS_TO_RUN="${2:?seconds required}"
INVALID_PCT="${3:?invalid percent required}"
URL="http://$(minikube ip):${NODE_PORT}/payments"
VALID="${REPO_ROOT}/scripts/sample-payment.json"

echo "Sending ~2 requests/second to ${URL} for ${SECONDS_TO_RUN}s, ${INVALID_PCT}% invalid"
end=$(( $(date +%s) + SECONDS_TO_RUN ))
sent=0; failed=0
while [ "$(date +%s)" -lt "$end" ]; do
  for _ in 1 2; do
    if [ $(( RANDOM % 100 )) -lt "$INVALID_PCT" ]; then
      code=$(curl -s -o /dev/null -w '%{http_code}' -m 3 -H 'Content-Type: application/json' -d '{"amount":-1}' "$URL")
    else
      code=$(curl -s -o /dev/null -w '%{http_code}' -m 3 -H 'Content-Type: application/json' --data @"$VALID" "$URL")
    fi
    sent=$((sent + 1)); [ "$code" -ge 400 ] && failed=$((failed + 1))
  done
  sleep 1
done
echo "Done: ${sent} requests, ${failed} failed ($(( failed * 100 / (sent > 0 ? sent : 1) ))%)"
