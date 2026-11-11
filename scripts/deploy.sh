#!/usr/bin/env bash
# Deploy kk-payments to one environment and wait for the rollout to finish.
# Usage: scripts/deploy.sh <staging|production> <image> [change-cause]
# Exit 0 = rollout complete. Exit 1 = rollout failed (diagnostics printed; the
# caller decides whether to roll back, so a rollback can never run twice).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_env "${1:-}"
IMAGE="${2:?image required, e.g. docker.io/derickharon/kk-payments:1.1.0-abc1234}"
VERSION="${IMAGE##*:}"
CHANGE_CAUSE="${3:-Deploy ${VERSION} to ${ENV_NAME}}"
CHANGE_CAUSE="${CHANGE_CAUSE//|/-}"   # | is the sed delimiter below

echo "== Deploying ${IMAGE} to ${ENV_NAME} (namespace ${NAMESPACE})"

# Seam checks: fail with a clear message instead of a Pod stuck in
# CreateContainerConfigError or ImagePullBackOff.
kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 \
  || { echo "ERROR: namespace ${NAMESPACE} missing. Run scripts/setup-environments.sh"; exit 1; }
kubectl -n "$NAMESPACE" get configmap "$CONFIGMAP_NAME" >/dev/null 2>&1 \
  || { echo "ERROR: ConfigMap ${CONFIGMAP_NAME} missing in ${NAMESPACE}. Run scripts/setup-environments.sh"; exit 1; }
kubectl -n "$NAMESPACE" get secret "$PULL_SECRET_NAME" >/dev/null 2>&1 \
  || { echo "ERROR: pull secret ${PULL_SECRET_NAME} missing in ${NAMESPACE}. Run scripts/setup-environments.sh"; exit 1; }

render() {
  sed -e "s|__IMAGE__|${IMAGE}|g" \
      -e "s|__VERSION__|${VERSION}|g" \
      -e "s|__REPLICAS__|${REPLICAS}|g" \
      -e "s|__NODE_PORT__|${NODE_PORT}|g" \
      -e "s|__CONFIGMAP_NAME__|${CONFIGMAP_NAME}|g" \
      -e "s|__PULL_SECRET_NAME__|${PULL_SECRET_NAME}|g" \
      -e "s|__CHANGE_CAUSE__|${CHANGE_CAUSE}|g" \
      "$1"
}

render "$REPO_ROOT/k8s/kk-payments-deployment.yaml" | kubectl -n "$NAMESPACE" apply -f -
render "$REPO_ROOT/k8s/kk-payments-service.yaml"    | kubectl -n "$NAMESPACE" apply -f -

if kubectl -n "$NAMESPACE" rollout status "deployment/${DEPLOYMENT_NAME}" --timeout=150s; then
  # NEW: wait until Pods of the old version are gone, so the Service only routes to new Pods
  kubectl -n "$NAMESPACE" wait --for=delete pod -l "app=kk-payments,version!=${VERSION}" --timeout=60s 2>/dev/null || true
  echo "== Rollout complete: ${ENV_NAME} is running ${VERSION}"
  kubectl -n "$NAMESPACE" get pods -l app=kk-payments -o wide
  exit 0
fi

echo "== ROLLOUT FAILED in ${ENV_NAME}: diagnostics"
kubectl -n "$NAMESPACE" get pods -l app=kk-payments
newest=$(kubectl -n "$NAMESPACE" get pods -l "app=kk-payments,version=${VERSION}" \
  --sort-by=.metadata.creationTimestamp -o name | tail -1)
if [ -n "$newest" ]; then
  echo "-- Events for ${newest}"
  kubectl -n "$NAMESPACE" describe "$newest" | sed -n '/^Events:/,$p'
  echo "-- Last log lines of the crashed container"
  kubectl -n "$NAMESPACE" logs "$newest" --previous --tail=20 2>/dev/null \
    || kubectl -n "$NAMESPACE" logs "$newest" --tail=20 2>/dev/null || true
fi
exit 1