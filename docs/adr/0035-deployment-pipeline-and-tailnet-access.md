# Deployment Pipeline and Tailnet Access

## Status

Accepted

## Context

ADR-0008 specifies Docker containers on K3s on an Oracle Cloud ARM VM, but the
repository has no production images, manifests, or CI. The deployment target is private:
the app runs on a single VM and is reached from a phone through Tailscale. There is no
public domain, no public TLS certificate, and no intention to expose the stack to the
internet. The repository is private, while the API still has no authentication (ADR-0009)
and the metrics endpoint must not be publicly reachable (#18).

Local verification must not depend on the VM, and deployments must be reproducible from a
clean checkout.

## Decision

### Images

- `apps/api` and `apps/web` each have a multi-stage Dockerfile. The build context is the
  repository root; `.dockerignore` excludes `node_modules`, `.git`, `.env`, and `dist`.
- The API builder installs all dependencies and generates the Prisma client. The runtime
  stage contains production dependencies only, runs as the non-root `bun` user, sets
  `NODE_ENV=production`, and never loads `pino-pretty`. A separate `migrate` target keeps
  the Prisma CLI out of the runtime image.
- The web builder produces the Vite/PWA output; the runtime is `nginx-unprivileged` on
  port 8080 with SPA fallback and cache headers.
- Images are published to public GHCR as `ghcr.io/marculm/gymos-api`,
  `ghcr.io/marculm/gymos-web`, and `ghcr.io/marculm/gymos-api-migrate`, tagged
  `sha-<commit>` and `latest`. Public packages need no pull secret and stay outside the
  private-package quota. No secret is passed as a build argument or baked into an image.
- An `app` profile in `deploy/docker/docker-compose.yml` runs Postgres, migrations, API,
  and web locally with the same images. The default `db:up` flow remains Postgres-only.

### CI and deployment

- Pull requests run checks only: Bun install, Prisma generate, `prisma migrate deploy`
  against a Postgres service container, typecheck, `lint:all`, tests, and the web build.
- Pushes to `main` run the same checks, build and push `linux/arm64` images, and then
  deploy. The deploy job runs only on `main`, only after checks and images succeed, and is
  serialized by a concurrency group.
- The deploy job joins the tailnet as an ephemeral `tag:ci` node through the Tailscale
  GitHub action and authenticates with `tailscale ssh`. No SSH private key is stored in
  GitHub. Access is granted by a tailnet ACL and revoked by changing the ACL or removing
  the OAuth client.
- The VM holds a checkout at `/srv/gymos` and runs `deploy/k8s/deploy.sh <sha>`. The script
  checks out the commit, applies the manifests, runs the migration Job to completion (which
  also seeds the configured owner idempotently), rolls out API and web with SHA-pinned
  images, and waits for the rollout. Manifests are
  applied only through this versioned script; no ad-hoc `kubectl` changes.
- Rollback is the same script with an earlier SHA. Prisma migrations are forward-only, so
  an application rollback is safe only when the schema change is backward compatible.

### Kubernetes

- `deploy/k8s/` contains the namespace, ConfigMap, secret example, Postgres StatefulSet
  with PVC, API and web Deployments and Services, the migration Job, and a Traefik
  Ingress.
- The Ingress serves HTTP inside the tailnet and matches any host: `/api` and `/health` go
  to the API, `/` goes to the web app. `/prometheus` is deliberately not routed.
- Traefik is never reachable from the public internet. The Oracle firewall opens no HTTP
  ports; Tailscale is the only path to the cluster.
- Tailscale Serve terminates TLS for the MagicDNS name and proxies to the local Traefik
  entrypoint (`tailscale serve --bg --https=8443 http://127.0.0.1:80`). Port 8443 avoids
  the Traefik listener on 443. The API does not load certificates (ADR-0016).
- The Postgres password and `DATABASE_URL` exist only in a Kubernetes Secret created on
  the VM. The repository contains `deploy/k8s/secret.example.yaml` with placeholders.

### Operations

- `docs/deployment.md` documents the VM, Tailscale, GHCR, secret, migration, deploy,
  rollback, and backup steps.
- `docs/known-issues.md` records that the tailnet deploy path is unverified until the VM
  exists.

## Consequences

- The same images build locally and in CI, and every deploy is reproducible by commit SHA.
- No long-lived SSH key exists in GitHub; revocation happens through the tailnet ACL or
  the OAuth client.
- Public images expose the API TypeScript source and dependency versions. This is accepted
  for a private, tailnet-only deployment; secrets must never reach an image.
- Dockerfile errors surface only on `main`, because images are not built on pull requests.
  This is accepted to save CI minutes.
- An application rollback after a destructive migration requires restoring the database
  from backup.
- The stack runs as a single replica with in-cluster Postgres and one PVC. There is no high
  availability, and durability depends on the documented backup path.
