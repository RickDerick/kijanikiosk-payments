# AI governance log

Every use of an AI tool during the capstone build is recorded here in the eight-field format. Field 7 ("What it got wrong") is never empty: if nothing looked wrong, the output was not reviewed carefully enough.

**Review checklist applied to every AI output** (my six controls for infrastructure and pipeline code):
1. **Secrets:** no token, password or key in code, logs, state or evidence files.
2. **Least privilege:** nothing runs as root or with more access than it needs.
3. **Pinned and reproducible:** versions pinned; works from a clean checkout.
4. **Idempotent:** running it twice changes nothing the second time.
5. **Failure handling:** fails loudly, never "green while broken" and never "red while working"; a rollback path exists.
6. **Verified:** run or dry-run before it is trusted; evidence kept.

---

## Entry 1: Capstone scope document

| Field | Entry |
|---|---|
| Date | 2026-11-10 |
| Tool used | Claude (claude.ai) |
| Task description | Draft the one-page capstone scope (problem, components, out of scope, success criteria) |
| What was provided to the AI | Capstone page 1 (Project Planning & Scoping) and the history of my Weeks 4–9 work (Terraform, Jenkins, Docker Hub, Minikube, rollouts) |
| What the AI produced | A Track A scope: automated staging/production pipeline with automatic rollback, five components, three measurable success criteria |
| What it got right | A specific problem statement tied to a real Week 9 finding (a bad image stalls a rollout until a human rolls it back); measurable, demo-able criteria; each out-of-scope item had a reason |
| What it got wrong | It was drafted before the Submission Guide was read, so it **contradicted the Track A required components**: it created a `kijani-prod` namespace (Track A keeps production in `default`), left out Ansible, and put monitoring out of scope although a monitoring signal is required. It did not mention the required receipt-chain integration at all (control 6: not verified against the requirements) |
| What I changed before applying | Rewrote the scope against the Guide: production = `default`, Ansible configures both environments, Option B monitoring added, and the receipt chain explicitly descoped with a reason (my decision: I had not completed Week 10) |

## Entry 2: Runtime code (structured logging, config validation, graceful shutdown)

| Field | Entry |
|---|---|
| Date | 2026-11-10 |
| Tool used | Claude (claude.ai) |
| Task description | Add JSON logs with correlation IDs, fail-fast configuration loading and SIGTERM handling to kk-payments |
| What was provided to the AI | `src/app.js`, the `server.js` port/host lines, and the Week 8 finding that node as PID 1 ignores SIGTERM |
| What the AI produced | `src/logger.js`, `src/config.js`, updated `src/app.js` and `src/server.js`, and two new test files |
| What it got right | X-Request-Id is reused or generated and logged on every line; the app exits 1 naming the missing variable; SIGTERM closes the server cleanly (exit 0) |
| What it got wrong | (a) The first test teardown `afterAll((done) => server.close(done))` returned a value, which Jest rejects; found by running the tests (control 6). (b) It changed the `/health` response without having my existing test file, so `tests/app.test.js` line 29 would have failed in Jenkins |
| What I changed before applying | Teardown rewritten with a block body; I updated line 29 of `tests/app.test.js` for the new `environment` field and ran all 35 tests locally before committing (commit f97a05c) |

## Entry 3: Jenkinsfile delivery stages

| Field | Entry |
|---|---|
| Date | 2026-11-10 |
| Tool used | Claude (claude.ai) |
| Task description | Extend my Week 5 Jenkinsfile with image build/push, staging deploy, smoke test, automatic rollback, approval gate and production deploy |
| What was provided to the AI | My Week 5 Jenkinsfile and the Track A requirements |
| What the AI produced | A declarative pipeline: CI on the controller, delivery on a `k8s-deployer` agent, an `input` gate with no agent, rollback in `post { failure }` guarded by a "deployed" flag |
| What it got right | Rollback runs exactly once, and never for a failure before deployment; the approval gate holds no executor; Docker login isolated in a per-build `DOCKER_CONFIG`; existing image tags are never overwritten |
| What it got wrong | Its first version ran `smoke-test.sh … \| tee smoke-staging.txt` in Jenkins' default `/bin/sh`, which has **no `pipefail`**: `tee` succeeds, so **a failed smoke test would have passed the stage** (a false green; control 5). Caught in review before the first run |
| What I changed before applying | The smoke steps run under `#!/bin/bash` with `set -eo pipefail`. Verified for real by build #47: when the smoke test failed, the stage went red and the rollback ran (commit af23db6, evidence `docs/evidence/04-build47-auto-rollback.txt`) |

## Entry 4: Smoke test correlation check (false failure)

| Field | Entry |
|---|---|
| Date | 2026-11-11 |
| Tool used | Claude (claude.ai) |
| Task description | Smoke-test script that proves a request's correlation ID appears in the structured logs |
| What was provided to the AI | The runtime design (JSON logs with `requestId`) and the environment files |
| What the AI produced | `scripts/smoke-test.sh` checking version, environment, a 202 and a 400, then `kubectl logs … \| grep -q "<requestId>"` |
| What it got right | The checks match the success criteria; it runs through the real NodePort, so it tests what a client sees |
| What it got wrong | Under `set -o pipefail`, `grep -q` exits at the first match, `kubectl` gets a broken pipe, and the pipeline reports failure: **the check said "not found" because it found the line** (a false red; control 5). Found on my first manual run, when staging and production both failed only on that step while the log line was clearly present |
| What I changed before applying | The script reads the logs into a variable first, then searches it with `grep -qF`. Both environments then reported `SMOKE PASSED` (commit 2d69226) |

## Entry 5: AI-assisted analysis of a real incident (pipeline build #47)

| Field | Entry |
|---|---|
| Date | 2026-11-11 |
| Tool used | Claude (claude.ai) |
| Task description | Diagnose why build #47's staging smoke test failed after a successful rollout, and decide the fix |
| What was provided to the AI | The Jenkins console output from Deploy Staging to the end of the build (no secrets; checked with `grep -c dckr_pat` = 0) |
| What the AI produced | Diagnosis: curl exit 28 is a timeout; the rollout had "completed" while an old Pod was still Terminating, so a request was routed to a Pod whose network was being torn down. It confirmed the automatic rollback had worked (staging back on 1.1.0-036ed12; production stages skipped) |
| What it got right | The root cause, read directly from the evidence (exit code 28 plus the Terminating Pod in the rollout output), and the observation that the rollback behaved as designed |
| What it got wrong | **The incident was caused by its own earlier script**: `deploy.sh` treated `rollout status` as "only new Pods receive traffic", and the payment requests in the smoke test had no retry (control 5: untested failure mode). Its first instruction to apply the fix also assumed a new branch and PR flow when time was short, which I simplified |
| What I changed before applying | `deploy.sh` now waits for old-version Pods to be deleted; smoke requests retry 3 times and fail with a readable message instead of a silent exit. Build #48 then passed staging, the approval gate and production (commit 47f68ac; GitHub Issue for the race closed with that commit) |

## Entry 6: AI-assisted diagnosis of a Jenkins controller failure (build #46)

| Field | Entry |
|---|---|
| Date | 2026-11-11 |
| Tool used | Claude (claude.ai) |
| Task description | Explain why build #46 failed in 38 seconds before any stage ran |
| What was provided to the AI | The console output: `Failed to exec spawn helper … Cannot run program "git"` |
| What the AI produced | Diagnosis: the controller's JVM could no longer start processes after Java was updated underneath it; fix: restart Jenkins on the VM |
| What it got right | The cause and the fix; the build after the restart ran normally |
| What it got wrong | It did not address recurrence: it did not suggest checking which package update caused it or holding the JDK package (`apt-mark hold`) so an unattended upgrade cannot break the controller again (control 3: reproducibility) |
| What I changed before applying | Restarted Jenkins, documented the symptom and fix in `docs/runbook.md` (Known setup pitfalls), and logged a GitHub Issue for it. Holding the JDK version is listed as follow-up work |
