#!/usr/bin/env bash
# Shared helper: loads environments/common.env and environments/<env>.env.
# Sourced by deploy.sh, smoke-test.sh, rollback.sh, monitor-error-rate.sh, generate-traffic.sh.
load_env() {
  local env_name="$1"
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  case "$env_name" in
    staging|production) ;;
    *) echo "ERROR: environment must be 'staging' or 'production' (got '${env_name}')" >&2; return 2 ;;
  esac
  set -a
  # shellcheck disable=SC1091
  . "$root/environments/common.env"
  # shellcheck disable=SC1090
  . "$root/environments/${env_name}.env"
  set +a
  ENV_NAME="$env_name"
  REPO_ROOT="$root"
  export ENV_NAME REPO_ROOT
}
