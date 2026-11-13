# kk-payments runbook

All commands run from the repository root on the laptop that hosts Minikube.

## Deploy a specific version by hand (pipeline unavailable)
```bash
scripts/deploy.sh staging docker.io/derickharon/kk-payments:<version>-<sha> "manual: <reason>"
scripts/smoke-test.sh staging <version>-<sha>
# only after staging passes:
scripts/deploy.sh production docker.io/derickharon/kk-payments:<version>-<sha> "manual: <reason>"
scripts/smoke-test.sh production <version>-<sha>
```
Then update Git so it matches what is running (the declarative rule from Week 9).

## Roll back
```bash
scripts/rollback.sh staging          # or production: previous revision
kubectl -n default rollout history deployment/kk-payments
kubectl -n default rollout undo deployment/kk-payments --to-revision=<N>   # a specific revision
```
A rollback restores service; it is not a fix. Revert or fix the commit, let the pipeline build a new tag, and never re-push the broken tag.

## Diagnose a failing Pod (target: named cause in under 3 minutes)
Start wide, then narrow: `get` → `describe` (read **Events**) → `logs` → `exec`.

| STATUS | First command | Where the cause is |
|---|---|---|
| `Pending` | `kubectl -n <ns> describe pod <pod>` | Events: `Insufficient memory/cpu`; in staging also **`exceeded quota`** (ResourceQuota) |
| `ImagePullBackOff` | `kubectl -n <ns> describe pod <pod>` | Events: tag not found, or `unauthorized` (pull secret: rerun `scripts/setup-environments.sh`) |
| `CreateContainerConfigError` | `kubectl -n <ns> describe pod <pod>` | Events: `configmap "kk-payments-config" not found` (rerun setup) |
| `CrashLoopBackOff` | `kubectl -n <ns> logs <pod> --previous` | JSON line `"msg":"startup failed: invalid configuration"` names the missing variable |
| `OOMKilled` (exit 137) | `kubectl -n <ns> describe pod <pod>` | Last State: `OOMKilled`; raise `limits.memory` in the manifest |
| Running but `0/1` READY | `kubectl -n <ns> describe pod <pod>` | Events: `Readiness probe failed`; check `/health` from inside with `kubectl exec <pod> -- wget -qO- http://127.0.0.1:3001/health` |

## Trace one request
```bash
curl -s -H 'X-Request-Id: incident-42' http://$(minikube ip):30001/payments -d '{"amount":-1}'
kubectl -n default logs -l app=kk-payments --since=10m --tail=-1 | grep incident-42
```

## Check the error rate
```bash
scripts/monitor-error-rate.sh production 15m     # writes monitoring/reports/production-error-rate.json
```
`STATUS: ALERT` means more than 5% of /payments requests failed in 2 consecutive minutes. Next: check the `payment rejected` log lines for the dominant error, and whether the alert started with a release (`rollout history`).

## Rotate the Docker Hub token
1. Create a new token on Docker Hub and save it to `~/.secrets/dockerhub-token`.
2. `DOCKERHUB_TOKEN_FILE=~/.secrets/dockerhub-token scripts/setup-environments.sh` (updates both pull secrets).
3. Update the Jenkins credential `dockerhub-credentials`.
4. Revoke the old token on Docker Hub.

## Rebuild everything from zero
```bash
minikube delete && docker system prune -a -f
minikube start --driver=docker
DOCKERHUB_TOKEN_FILE=~/.secrets/dockerhub-token scripts/setup-environments.sh
# then run the pipeline (Build Now) to deploy the current main to both environments
```

## Known setup pitfalls (found during the capstone build)
- **Agent "Handshake error … Did not receive X-Remoting-Capability header":** `~/.secrets/jenkins-agent-secret` must contain only the 64-character hex secret from the node page, not the whole `java -jar …` command.
- **Controller "Failed to exec spawn helper … JDK version mismatch":** Java was upgraded underneath a running Jenkins (automatic Ubuntu update). Restart it on the VM: `multipass exec kijanikiosk-api -- sudo systemctl restart jenkins`.
- **"No route to host 192.168.49.2:8443" from kubectl or Ansible:** Minikube is stopped (laptop slept or rebooted). Run `minikube start`.
- **Smoke test fails right after a rollout (curl exit 28):** a request reached a Pod that was still terminating. `deploy.sh` now waits for old-version Pods to be deleted, and the smoke test retries each request (commit 47f68ac).
