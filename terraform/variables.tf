variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "student-task-manager"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "key_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}

variable "admin_cidr" {
  description = "Your public IP in CIDR form (e.g. 203.0.113.7/32). Limits SSH, Grafana and Prometheus access."
  type        = string
}

variable "repo_url" {
  description = "Public Git URL of this project (cloned onto the server for compose + monitoring configs)"
  type        = string
}

variable "image_prefix" {
  description = "Image name prefix, e.g. ghcr.io/<github-user>/student-task-manager (the -backend / -frontend suffix is added by compose)"
  type        = string
}

variable "grafana_password" {
  type      = string
  sensitive = true
  default   = "change-me"
}
