# Capstone reflection

**Derick Haron · KijaniKiosk kk-payments · Track A · presented 11 November 2026**

## 1. What did I get wrong?

I assumed that when `kubectl rollout status` reports success, only the new Pods receive traffic. Build #47 proved otherwise. The rollout completed, but one old Pod was still terminating, and the smoke test's payment request was routed to it and timed out (curl exit 28). The pipeline handled it as designed: it rolled staging back to the previous version and never offered production. But the failure was in my own release script, not in the application. "Rollout complete" means the Deployment reached its desired state, not that the Service has stopped routing to Pods that are shutting down. I fixed it by waiting for old-version Pods to be deleted and by letting each smoke request retry, and build #48 went through staging, approval and production.

With what I know now, I would design the smoke test around what a client actually sees during a rollout, and test the failure modes of the pipeline itself before trusting its green.

I also scoped the project before reading the Track A requirements. My first scope created a separate production namespace and left monitoring out, both of which contradicted the brief. Reading the acceptance criteria before designing would have saved a rewrite.

[Add one sentence on what happened in your live demo or what the supervisor asked.]

## 2. The most important thing I learned

**A pipeline's exit codes are its contract.** This started in Week 5 with `set -e` and failing fast, continued in Week 7 with a deploy script that must exit non-zero, and in Week 9 with `rollout status` as the release gate. The capstone made it concrete twice in opposite directions. Piping the smoke test into `tee` without `pipefail` would have turned a failed test green. Combining `grep -q` with `pipefail` turned a passing check red. What changed in how I think about delivery: a green build must **prove the right version is serving**, from the outside, not just that every command ran. Automation is only as safe as its ability to say "this failed" correctly.

## 3. What would a second pass look like?

- **Least privilege for the deployer:** replace my cluster-admin kubeconfig on the agent with a ServiceAccount per namespace and an RBAC Role limited to Deployments, Services and Pod logs.
- **Continuous monitoring:** move the error-rate rule from an on-demand script to Prometheus, with an alert routed to on-call.
- **Hardened image:** run as numeric UID 10001 so `runAsNonRoot: true` can be enforced.
- **GitOps:** have Argo CD pull the manifests from Git, so the cluster cannot drift from the repository.
- **Integrate the Week 10 receipt chain** through a receipts-bucket value in the same ConfigMap.
- **Peer review first:** schedule a classmate to follow the README cold before the build is finished, not after.
# what happened during my presentation
During the presentation, my supervisor asked how Terraform, Ansible and Jenkins share configuration, which I explained using the environments/*.env single source of truth.