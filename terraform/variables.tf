variable "kubeconfig_path" {
  description = "Path to the kubeconfig used to reach the cluster"
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "kubeconfig context of the target cluster"
  type        = string
  default     = "minikube"
}

variable "staging_quota" {
  description = "Hard limits for the staging namespace: room for 2 replicas plus 1 surge Pod"
  type        = map(string)
  default = {
    "pods"            = "6"
    "requests.cpu"    = "1"
    "requests.memory" = "512Mi"
    "limits.cpu"      = "2"
    "limits.memory"   = "1Gi"
  }
}
