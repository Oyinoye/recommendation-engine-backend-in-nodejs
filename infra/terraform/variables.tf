variable "project_id" {
  type        = string
  description = "GCP project id"
}

variable "region" {
  type        = string
  description = "GCP region"
  default     = "us-central1"
}

variable "api_image" {
  type        = string
  description = "Container image for the API service"
}

variable "worker_image" {
  type        = string
  description = "Container image for the worker service"
}
