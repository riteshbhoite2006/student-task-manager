#!/bin/bash
# Runs once on first boot of the EC2 instance.
set -euxo pipefail

apt-get update -y
apt-get install -y git curl
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

git clone ${repo_url} /opt/student-task-manager
cd /opt/student-task-manager
chown -R ubuntu:ubuntu /opt/student-task-manager

cat > .env <<ENVEOF
IMAGE_PREFIX=${image_prefix}
TAG=latest
GRAFANA_PASSWORD=${grafana_password}
ENVEOF

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
