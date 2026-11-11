#!/usr/bin/env bash
# Run the log-based error-rate monitor against one environment.
# Usage: scripts/monitor-error-rate.sh <staging|production> [since, default 10m]
# Writes monitoring/reports/<env>-error-rate.json and prints STATUS: OK or ALERT.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_env "${1:-}"
SINCE="${2:-10m}"
mkdir -p "${REPO_ROOT}/monitoring/reports"
kubectl -n "$NAMESPACE" logs -l app=kk-payments --since="$SINCE" --tail=-1 --max-log-requests=10 \
  | python3 "${REPO_ROOT}/monitoring/error_rate.py" --out "${REPO_ROOT}/monitoring/reports/${ENV_NAME}-error-rate.json"
