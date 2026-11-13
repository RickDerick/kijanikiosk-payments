# Capstone test plan (for the peer reviewer)

**System:** kk-payments staging-first delivery pipeline, Track A. **Please don't ask me for help during steps 1–3: if the README doesn't get you there, that's a finding.** Log every surprise, however small.

| # | Test | Steps | Expected result |
|---|---|---|---|
| 1 | **Fresh setup** | Follow README *Prerequisites* and *Setup* in a fresh terminal | `setup-environments.sh` finishes; `kubectl get ns kijani-staging` exists; both ConfigMaps printed with different `DB_HOST` |
| 2 | **Happy path** | Make a harmless change (e.g. a comment), commit on a branch, open a PR, merge to `main`; watch Jenkins | All stages green up to **Approve Production**; the approval message shows `SMOKE PASSED … environment=staging`; after approving, production `/health` shows the same version |
| 3 | **Failure path** | Merge the deliberate fault branch `fault/require-gateway-url` (adds a required setting that no ConfigMap provides) | Deploy Staging fails within ~2.5 min; console shows `ROLLOUT FAILED` with the `startup failed` log line; the rollback runs; staging `/health` still returns the previous version; production untouched; no approval offered |
| 4 | **Monitoring** | `scripts/generate-traffic.sh staging 150 20` then `scripts/monitor-error-rate.sh staging 5m` | `STATUS: ALERT`; repeat with `0` instead of `20`, giving `STATUS: OK` |
| 5 | **Correlation ID** | `curl -H 'X-Request-Id: peer-1' http://$(minikube ip):30002/health` then the grep from README *Verify* | Exactly the log line(s) for `peer-1` |
| 6 | **AI governance** | Read `docs/ai-governance-log.md` | Each entry names a concrete mistake and a concrete change; say whether you find the review steps credible |

For each finding, note: what you did, what happened, what you expected, and severity: **blocks setup / breaks functionality / unclear documentation / minor improvement**.
