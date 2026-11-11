#!/usr/bin/env bash
# Roll one environment back to its previous revision and show the result.
# Usage: scripts/rollback.sh <staging|production>
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_env "${1:-}"

echo "== ROLLBACK ${ENV_NAME} (namespace ${NAMESPACE})"
if ! kubectl -n "$NAMESPACE" rollout undo "deployment/${DEPLOYMENT_NAME}"; then
  echo "No previous revision to roll back to (first deployment in ${NAMESPACE})."
  exit 1
fi
kubectl -n "$NAMESPACE" rollout status "deployment/${DEPLOYMENT_NAME}" --timeout=150s
echo "-- Now serving:"
curl -s -m 5 "http://$(minikube ip):${NODE_PORT}/health"; echo
kubectl -n "$NAMESPACE" rollout history "deployment/${DEPLOYMENT_NAME}"
