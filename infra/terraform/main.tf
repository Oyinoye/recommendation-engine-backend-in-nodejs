terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_pubsub_topic" "user_events" {
  name                       = "user-events"
  message_retention_duration = "86400s"
}

resource "google_pubsub_topic" "dead_letter_events" {
  name = "dead-letter-events"
}

resource "google_pubsub_subscription" "user_events_subscription" {
  name  = "user-events-sub"
  topic = google_pubsub_topic.user_events.name

  ack_deadline_seconds = 60

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter_events.id
    max_delivery_attempts = 5
  }
}

resource "google_cloud_run_service" "api" {
  name     = "segment-context-api"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.api.email
      containers {
        image = var.api_image

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "PUBSUB_TOPIC"
          value = google_pubsub_topic.user_events.name
        }

        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }
      }

      container_concurrency = 80
      timeout_seconds       = 300
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service" "worker" {
  name     = "segment-context-worker"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.worker.email
      containers {
        image = var.worker_image

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "PUBSUB_SUBSCRIPTION"
          value = google_pubsub_subscription.user_events_subscription.name
        }

        resources {
          limits = {
            cpu    = "4"
            memory = "4Gi"
          }
        }
      }

      container_concurrency = 10
      timeout_seconds       = 900
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_service_account" "api" {
  account_id   = "segment-context-api"
  display_name = "Segment Context API"
}

resource "google_service_account" "worker" {
  account_id   = "segment-context-worker"
  display_name = "Segment Context Worker"
}

resource "google_project_iam_member" "api_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "worker_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "worker_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

output "pubsub_topic" {
  value = google_pubsub_topic.user_events.name
}

output "pubsub_subscription" {
  value = google_pubsub_subscription.user_events_subscription.name
}

output "cloud_run_api" {
  value = google_cloud_run_service.api.status[0].url
}

output "cloud_run_worker" {
  value = google_cloud_run_service.worker.status[0].url
}
