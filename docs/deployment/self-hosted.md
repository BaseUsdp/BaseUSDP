# Self-Hosted Deployment

## Requirements
- Docker and Docker Compose
- 2GB RAM, 10GB storage
- Domain with SSL
- Base RPC endpoint

## Quick Start
```bash
git clone https://github.com/BaseUsdp/BaseUSDP.git
cd BaseUSDP
cp docker/.env.example docker/.env
docker compose -f docker/docker-compose.yml up -d
```

## Updating
```bash
git pull origin main
docker compose -f docker/docker-compose.yml up -d --build
```

## Monitoring
- Health check: GET /api/health
- Docker health checks in docker-compose.yml
- Recommend Prometheus/Grafana for production
