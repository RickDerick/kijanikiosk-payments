output "staging_namespace" {
  description = "Namespace created for staging"
  value       = kubernetes_namespace_v1.kijani_staging.metadata[0].name
}

output "staging_quota" {
  description = "Resource limits applied to staging"
  value       = kubernetes_resource_quota_v1.kijani_staging_quota.spec[0].hard
}
