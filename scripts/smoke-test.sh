#!/usr/bin/env bash
# Smoke test one environment through its NodePort.
# Usage: scripts/smoke-test.sh <staging|production> <expected-version>
# Checks: /health reports the expected version and environment, a valid payment
# is accepted (202), an invalid one is rejected (400), and the request's
# correlation ID appears in the structured logs.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_env "${1:-}"
EXPECTED_VERSION="${2:?expected version required, e.g. 1.1.0-abc1234}"

BASE_URL="http://$(minikube ip):${NODE_PORT}"
REQ_ID="smoke-${ENV_NAME}-$(date +%s)"
BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT
fail() { echo "SMOKE FAILED (${ENV_NAME}): $*"; exit 1; }

echo "== Smoke test ${ENV_NAME} at ${BASE_URL} (X-Request-Id: ${REQ_ID})"

HEALTH=""
for _ in $(seq 1 10); do
  HEALTH=$(curl -fsS -m 3 -H "X-Request-Id: ${REQ_ID}" "${BASE_URL}/health" 2>/dev/null) && break
  sleep 2
done
[ -n "$HEALTH" ] || fail "no response from ${BASE_URL}/health"
echo "health:  ${HEALTH}"
grep -q "\"version\":\"${EXPECTED_VERSION}\"" <<<"$HEALTH" || fail "expected version ${EXPECTED_VERSION}"
grep -q "\"environment\":\"${APP_ENV}\"" <<<"$HEALTH"     || fail "expected environment ${APP_ENV}"

code=$(curl -s -o "$BODY" -w '%{http_code}' -m 5 -H 'Content-Type: application/json' \
  -H "X-Request-Id: ${REQ_ID}" --data @"${REPO_ROOT}/scripts/sample-payment.json" "${BASE_URL}/payments")
echo "valid payment:   HTTP ${code} $(cat "$BODY")"
[ "$code" = "202" ] || fail "valid payment returned ${code}, expected 202"

code=$(curl -s -o "$BODY" -w '%{http_code}' -m 5 -H 'Content-Type: application/json' \
  -H "X-Request-Id: ${REQ_ID}" --data '{"amount":-1}' "${BASE_URL}/payments")
echo "invalid payment: HTTP ${code}"
[ "$code" = "400" ] || fail "invalid payment returned ${code}, expected 400"

sleep 2
if kubectl -n "$NAMESPACE" logs -l app=kk-payments --since=5m --tail=-1 | grep -q "\"requestId\":\"${REQ_ID}\""; then
  echo "correlation: ${REQ_ID} found in structured logs"
else
  fail "request ID ${REQ_ID} not found in logs"
fi

echo "SMOKE PASSED: environment=${APP_ENV} version=${EXPECTED_VERSION} requestId=${REQ_ID}"
