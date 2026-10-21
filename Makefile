.PHONY: test up down logs ps k8s-apply k8s-delete tf-init tf-plan tf-apply tf-destroy

test:        ## run backend unit tests
	cd backend && npm install && npm test

up:          ## build and start app + monitoring
	docker compose up --build -d
	@echo "App: http://localhost:8080  |  Grafana: http://localhost:3001  |  Prometheus: http://localhost:9090"

down:        ## stop everything (add -v manually to wipe data)
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

k8s-apply:
	kubectl apply -f k8s/namespace.yaml && kubectl apply -f k8s/

k8s-delete:
	kubectl delete namespace student-task-manager

tf-init:
	cd terraform && terraform init
tf-plan:
	cd terraform && terraform plan
tf-apply:
	cd terraform && terraform apply
tf-destroy:
	cd terraform && terraform destroy
