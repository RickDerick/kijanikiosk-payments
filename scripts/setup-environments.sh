#!/usr/bin/env bash
# One command to create and configure both environments from a clean cluster:
#   Terraform -> kijani-staging namespace + quota
#   Ansible   -> ConfigMap + registry pull secret in kijani-staging and default
# Usage:
#   DOCKERHUB_TOKEN_FILE=/path/outside/repo/.dockerhub-token scripts/setup-environments.sh
set -euo pipefail
cd "$(dirname "$0")/.."

for tool in terraform ansible-playbook kubectl minikube; do
  command -v "$tool" >/dev/null || { echo "ERROR: $tool is not installed (see README Prerequisites)"; exit 1; }
done
: "${DOCKERHUB_TOKEN_FILE:?Set DOCKERHUB_TOKEN_FILE to a file (outside the repo) holding Docker Hub access token}"
[ -r "$DOCKERHUB_TOKEN_FILE" ] || { echo "ERROR: cannot read $DOCKERHUB_TOKEN_FILE"; exit 1; }

export DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-derickharon}"
DOCKERHUB_TOKEN="$(tr -d '[:space:]' < "$DOCKERHUB_TOKEN_FILE")"
export DOCKERHUB_TOKEN

echo "== Cluster"
minikube status >/dev/null || { echo "ERROR: minikube is not running (minikube start)"; exit 1; }
kubectl config use-context minikube >/dev/null

echo "== Terraform: staging namespace"
terraform -chdir=terraform init -input=false
terraform -chdir=terraform apply -input=false -auto-approve

echo "== Ansible collections"
ansible-galaxy collection install -r ansible/requirements.yml >/dev/null

for env in staging production; do
  echo "== Ansible: configure $env"
  ansible-playbook -i ansible/inventory/hosts.yml ansible/playbook.yml -e target_env="$env"
done

echo "== Result"
for env in staging production; do
  ns=$(grep '^NAMESPACE=' "environments/$env.env" | cut -d= -f2)
  echo "-- $env (namespace $ns)"
  kubectl -n "$ns" get configmap kk-payments-config -o jsonpath='{.data}'; echo
  kubectl -n "$ns" get secret kijani-registry-credentials -o jsonpath='{.type}'; echo
done
kubectl get resourcequota -n kijani-staging
