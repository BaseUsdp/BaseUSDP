.PHONY: dev build start lint test clean setup docker-build docker-up docker-down

# Development
dev:
	npm run dev

build:
	npm run build

start:
	npm run start

# Quality
lint:
	npm run lint

lint-fix:
	npm run lint -- --fix

format:
	npx prettier --write "src/**/*.{ts,tsx,css,json}"

type-check:
	npx tsc --noEmit

# Testing
test:
	npm test

test-watch:
	npm test -- --watch

test-coverage:
	npm test -- --coverage

# Setup
setup:
	npm ci
	cp -n .env.example .env.local || true
	@echo "Setup complete. Edit .env.local with your configuration."

clean:
	rm -rf node_modules .next dist build coverage
	npm ci

# Docker
docker-build:
	docker compose -f docker/docker-compose.yml build

docker-up:
	docker compose -f docker/docker-compose.yml up -d

docker-down:
	docker compose -f docker/docker-compose.yml down

docker-logs:
	docker compose -f docker/docker-compose.yml logs -f

# Database
db-migrate:
	npx supabase db push

db-reset:
	npx supabase db reset

# Utilities
check-deps:
	npx npm-check-updates

validate-env:
	./scripts/validate-env.sh
