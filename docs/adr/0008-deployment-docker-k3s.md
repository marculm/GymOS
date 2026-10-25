# Deployment: Docker Containers on K3s

## Status

Accepted

## Context

We want a production deployment that costs $0/month and is reproducible. Oracle Cloud Always Free Tier provides ARM VMs with enough resources for a lightweight Kubernetes setup. Local development should mirror production as closely as possible.

## Decision

We will containerize all services with **Docker** and deploy to a **K3s** (lightweight Kubernetes) cluster.

```
deploy/
  docker/         # Docker Compose for local development
  k8s/            # K3s manifests for production
    postgres-pvc.yaml
    api-deployment.yaml
    web-deployment.yaml
```

### Environments

| Environment | Tool | Purpose |
|------------|------|---------|
| Local dev  | Docker Compose / K3d | Fast iteration |
| Production | K3s on Oracle Cloud ARM VM | Free hosting |

### Rules

1. Every deployable app (`apps/api`, `apps/web`) must have a `Dockerfile`.
2. Dockerfiles use **multi-stage builds** — no dev dependencies in production images.
3. K8s manifests are the source of truth for production config — no manual `kubectl` changes.
4. Secrets are managed via Kubernetes Secrets — never committed to the repo.

## Consequences

- $0/month hosting on Oracle Cloud Free Tier.
- Local dev environment mirrors production (same containers, same networking).
- Kubernetes provides built-in health checks, restarts, and scaling (if ever needed).
