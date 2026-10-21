# 📚 Student Task Manager — with a full DevOps pipeline

A simple web app where students **add tasks, view them, mark them completed, and delete them**,
delivered through an automated DevOps workflow.

| Concern | Tool | Where |
|---|---|---|
| Source control & CI | GitHub Actions | `.github/workflows/ci-cd.yml` |
| Automated testing | Node test runner + Docker smoke test | `backend/test/`, `smoke-test` job |
| Containerization | Docker, Docker Compose | `*/Dockerfile`, `docker-compose*.yml` |
| Image registry | GitHub Container Registry (GHCR) | `publish` job |
| Deployment | SSH deploy to server / Kubernetes | `deploy` job, `k8s/` |
| Infrastructure as Code | Terraform (AWS EC2) | `terraform/` |
| Monitoring & alerting | Prometheus + Grafana | `monitoring/` |

## Architecture

```
            ┌────────────── Docker network ───────────────┐
 Browser ──►│ nginx (frontend :80) ──/api──► Express API  │
            │                                 :3000       │
            │   Prometheus :9090 ──scrapes /metrics──┘    │
            │   Grafana    :3001 ──queries Prometheus     │
            └─────────────────────────────────────────────┘
 Git push ► GitHub Actions: test ► build + smoke test ► push images ► deploy
```

## Features
- Add a task (title, optional notes, optional deadline)
- View tasks — filter by All / Pending / Completed; overdue and due-today badges
- Mark complete / reopen
- Delete
- Data persists in a JSON file on a Docker volume

### API
| Method | Path | Description |
|---|---|---|
| GET | `/api/tasks?status=pending\|completed` | list tasks |
| POST | `/api/tasks` | create `{title, description?, deadline?}` |
| PATCH | `/api/tasks/:id` | update (`completed`, `title`, …) |
| DELETE | `/api/tasks/:id` | delete |
| GET | `/health` | liveness/readiness |
| GET | `/metrics` | Prometheus metrics |

## 1. Run it locally
```bash
make up            # or: docker compose up --build -d
```
- App: http://localhost:8080
- Grafana: http://localhost:3001 (admin / admin) → dashboard **Student Task Manager - Overview**
- Prometheus: http://localhost:9090 (check *Status → Targets* and *Alerts*)

Without Docker: `cd backend && npm install && npm start`, then serve `frontend/` behind any proxy that
forwards `/api` to port 3000.

## 2. Test
```bash
make test
```

## 3. CI/CD pipeline (GitHub Actions)
1. Create a GitHub repo and push this project to `main`.
2. Every push/PR runs **test** → **smoke-test** (builds images, starts the whole stack, hits the API).
3. On `main`, **publish** pushes images to `ghcr.io/<you>/student-task-manager-{backend,frontend}`
   tagged `latest` and with the commit SHA.
   - After the first run, make both packages **public** (GitHub → Packages → Package settings)
     so the server can pull without logging in.
4. Optional **deploy** job: set repo variable `DEPLOY_ENABLED=true` and secrets
   `SERVER_HOST` (public IP) and `SERVER_SSH_KEY` (private key contents).

## 4. Provision infrastructure (Terraform → AWS)
Prereqs: AWS credentials configured, an EC2 key pair, images already published (step 3).
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # edit values
terraform init
terraform plan
terraform apply
```
Outputs give you the app, Grafana, and Prometheus URLs. The instance installs Docker on first boot,
clones this repo, and runs `docker-compose.prod.yml`. SSH, Grafana and Prometheus are only open to
`admin_cidr`. Clean up with `terraform destroy` (a t3.micro is free-tier eligible on new accounts, but
check your own billing).

## 5. Kubernetes (optional)
```bash
docker build -t student-task-manager-backend:latest  ./backend
docker build -t student-task-manager-frontend:latest ./frontend
# minikube: minikube image load <image>   kind: kind load docker-image <image>
# then edit the image: lines in k8s/*.yaml to match, and:
make k8s-apply
kubectl get pods -n student-task-manager
```
App on `http://<node-ip>:30080` (`minikube service frontend -n student-task-manager`).

## 6. Monitoring
Dashboard panels: backend up/down, pending vs completed tasks, request rate by route, p95 latency,
4xx/5xx rates, process memory. Alert rules (`monitoring/alerts.yml`): `BackendDown`, `HighErrorRate`,
`SlowRequests`.

**Try it:** generate traffic, then break something.
```bash
for i in $(seq 1 50); do curl -s -XPOST localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"title":"load '$i'"}' >/dev/null; done
docker compose stop backend      # watch BackendDown fire in Prometheus after ~1 min
docker compose start backend
```

## Project layout
```
backend/      Express API, metrics, tests, Dockerfile
frontend/     index.html + nginx.conf + Dockerfile
monitoring/   prometheus.yml, alerts.yml, Grafana provisioning + dashboard
terraform/    AWS EC2 + security group + bootstrap script
k8s/          namespace, backend (PVC), frontend
.github/      CI/CD workflow
```

## Known limitations (good talking points for your report)
- JSON-file storage means a single backend instance; a real deployment would use PostgreSQL.
- No user accounts: all students share one list.
- Grafana/Prometheus run unauthenticated on Prometheus; they are restricted by firewall only.
- HTTP only; add a domain + TLS (Caddy, nginx + Let's Encrypt, or an ALB) for production.
