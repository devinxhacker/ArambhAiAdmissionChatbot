.PHONY: help up down logs build rebuild ps clean pull-model seed test fmt lint frontend backend ai crawler

help:
	@echo "Arambh — common commands"
	@echo "  make up           - start the full stack"
	@echo "  make down         - stop everything"
	@echo "  make build        - build all images"
	@echo "  make rebuild      - rebuild without cache"
	@echo "  make logs s=<svc> - tail logs for a service (or all)"
	@echo "  make pull-model   - pull llama3 into Ollama container"
	@echo "  make seed         - seed admin user + sample sources"
	@echo "  make test         - run all tests"
	@echo "  make clean        - remove volumes (DESTRUCTIVE)"

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

rebuild:
	docker compose build --no-cache

ps:
	docker compose ps

logs:
	docker compose logs -f $(s)

pull-model:
	@echo "Ollama runs on the host (not in Docker). Pulling on host..."
	@command -v ollama >/dev/null 2>&1 || { echo "ollama not installed. brew install ollama"; exit 1; }
	ollama pull llama3

seed:
	docker compose exec backend python -m app.scripts.seed
	docker compose exec ai-services python -m app.scripts.seed_sources

test:
	docker compose exec backend pytest -q
	docker compose exec ai-services pytest -q
	docker compose exec crawler pytest -q

clean:
	docker compose down -v
	rm -rf data/raw data/processed data/uploads data/qdrant data/redis
