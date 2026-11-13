# Demo script (target 6–7 minutes) and rehearsal checklist

## Before you present (T-30 min)
- [ ] `minikube status` Running; `docker start nexus`; `multipass start kijanikiosk-api`
- [ ] Jenkins agent terminal running and **online** in Jenkins
- [ ] Both environments healthy: `curl -s http://$(minikube ip):30002/health` and `:30001/health`
- [ ] Branch `fault/require-gateway-url` pushed and ready to merge (do not merge yet)
- [ ] A harmless change ready on `feature/demo-change`, PR open
- [ ] Browser tabs: Jenkins job page · GitHub PR · this script · `docs/ai-governance-log.md`
- [ ] Terminal font enlarged (Ctrl + +), notifications off
- [ ] Fallback screenshots folder `docs/evidence/` open in a file browser

## Run sheet
| Time | Show | Say (one line) |
|---|---|---|
| 0:00 | Terminal: `curl` staging and production `/health`, then `kubectl -n kijani-staging logs -l app=kk-payments --tail=3` | "It works: same version in both, different environment, and every request has a traceable ID in JSON logs." |
| 0:45 | Architecture slide | "Merge to main → CI on the controller → my laptop agent deploys to staging → smoke test → human gate → production." |
| 1:30 | Merge the demo PR; Jenkins **Build Now** if impatient | "No manual steps from here except the approval." |
| 1:45 | While CI runs: `environments/staging.env` and the Deployment manifest | "One source of truth; one manifest for both environments." |
| 3:00 | Smoke Test Staging output, then the **approval prompt** | "The gate only appears after staging is proven: version, environment, a real payment, and the request ID in the logs." |
| 3:30 | Approve → production `/health` | "Same image, now in production." |
| 4:00 | Merge `fault/require-gateway-url` (or show the recorded failed build if time is short) | "This release can't start: it needs a setting no environment has." |
| 5:00 | Console: `ROLLOUT FAILED` → Events → `startup failed` log → `ROLLBACK` → staging `/health` shows the old version | "Detected, rolled back, prod never touched, no human needed." |
| 5:45 | Monitor: pre-run `generate-traffic` output and `STATUS: ALERT` table | "Payment error rate over 5% for 2 minutes raises an alert from the logs alone." |
| 6:15 | `docs/ai-governance-log.md` Entry 3 | "AI wrote the pipeline; my review found that a failed smoke test would have gone green. Fixed before it ran." |
| 6:45 | Production gaps slide | Name 3 gaps and their fixes. |

**Timing tip:** a full pipeline run takes several minutes. Start the happy-path build **before** you begin talking (at 0:00), and use the recorded failure build if you're over time.

## Rehearse twice
- [ ] Rehearsal 1: run everything for real; note every step you did "from memory" and add it to this sheet or the README
- [ ] Rehearsal 2: time it with a stopwatch; record the Loom video during this run
- [ ] Reset after each rehearsal: `git revert` the fault merge, push, let the pipeline restore green

## Likely questions and short answers
- **Why maxUnavailable 0?** Week 9's watch log showed maxUnavailable 1 dropping to 2 of 3 Pods. For payments I pay one extra Pod during a rollout to keep full capacity.
- **Why does the laptop agent connect to Jenkins, not the reverse?** The VM can't route to Minikube's network; an outbound WebSocket from the laptop needs no inbound firewall or routing change.
- **Why isn't the image tag committed in the manifest?** The tag is derived from the commit (`<version>-<sha>`), so the Git commit *is* the version record. Rollout history and the change-cause annotation record what ran when.
- **What if Docker Hub is down?** Push fails, the build stops before staging, and production keeps running. A registry mirror is a production gap.
- **Why not Prometheus?** Option B gives the same signal from existing logs without running and securing a monitoring stack on a single-node lab cluster; Prometheus is the production next step.
