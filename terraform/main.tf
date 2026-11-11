provider "kubernetes" {
  config_path    = pathexpand(var.kubeconfig_path)
  config_context = var.kube_context
}

locals {
  # Read the namespace name from environments/staging.env (single source of truth)
  staging_env       = file("${path.module}/../environments/staging.env")
  staging_namespace = trimspace(regex("(?m)^NAMESPACE=(.*)$", local.staging_env)[0])
}

resource "kubernetes_namespace_v1" "kijani_staging" {
  metadata {
    name = local.staging_namespace
    labels = {
      "app.kubernetes.io/part-of"    = "kijanikiosk"
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = "staging"
    }
  }
}

# Isolation: a runaway staging release cannot consume the capacity production needs
resource "kubernetes_resource_quota_v1" "kijani_staging_quota" {
  metadata {
    name      = "kijani-staging-quota"
    namespace = kubernetes_namespace_v1.kijani_staging.metadata[0].name
  }
  spec {
    hard = var.staging_quota
  }
}
