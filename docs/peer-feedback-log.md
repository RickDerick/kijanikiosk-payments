# Peer feedback log

**Session type:** documented **self-review**, carried out while rebuilding and running the system from the README and runbook on 11 and 13 November 2026 (no classmate was available in the time left). Each finding is a GitHub Issue; fixes reference it.

Test plan used: `docs/test-plan.md`.

| # | Issue (specific) | Severity | Resolution | Evidence |
|---|---|---|---|---|
| 1 | Jenkins controller failed every build with `Failed to exec spawn helper … JDK version mismatch` after an automatic Java update on the VM; the README did not mention it | Breaks functionality | Restarted Jenkins; added the symptom and fix to `docs/runbook.md` under Known setup pitfalls. Follow-up: hold the JDK package version | Issue #5, commit adding the runbook section |
| 2 | Agent setup did not say the secret file must contain only the hex secret; pasting the whole `java -jar …` command caused a repeated "Handshake error" | Unclear documentation | Runbook now states the exact content of `~/.secrets/jenkins-agent-secret` and the error it prevents | Issue #6, closed by the documentation commit |
| 3 | The smoke test failed after a successful rollout (curl exit 28) because a request reached a Pod that was still terminating (build #47) | Breaks functionality | `deploy.sh` waits for old-version Pods to be deleted; smoke requests retry 3 times. Build #48 passed staging, approval and production | Issue #7, commit 47f68ac |
| 4 | After the laptop restarted, Ansible failed with `No route to host 192.168.49.2:8443`; nothing in the docs pointed to a stopped cluster | Unclear documentation | Runbook pitfall added: run `minikube start`; the demo checklist starts with `minikube status` | Runbook commit |

Severity scale: blocks setup · breaks functionality · unclear documentation · minor improvement.

**What a peer review would add:** someone who has never seen the system following the README cold. A classmate review is the first thing I would schedule in a second pass.
