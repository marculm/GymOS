# Deployment

GymOS runs on a single Oracle Cloud ARM VM with K3s. The VM is reached only through
Tailscale; no HTTP port is open to the internet. Images are built by GitHub Actions and
published as public GHCR packages (ADR-0035).

## Pipeline

Pull requests run checks only. A push to `main` runs:

1. `checks` — typecheck, lint, tests against a Postgres service, web build.
2. `images` — builds `linux/arm64` images and pushes them to GHCR:
   - `ghcr.io/marculm/gymos-api:sha-<commit>`
   - `ghcr.io/marculm/gymos-web:sha-<commit>`
   - `ghcr.io/marculm/gymos-api-migrate:sha-<commit>`
3. `deploy` — joins the tailnet as an ephemeral `tag:ci` node and runs
   `/srv/gymos/deploy/k8s/deploy.sh <commit>` on the VM over Tailscale SSH.

Each image is also tagged `latest`; deployments use the immutable commit tag.

## Local full stack

The `app` profile builds and runs the production images locally:

```bash
bun run db:down
docker compose --env-file .env -f deploy/docker/docker-compose.yml \
  --profile app up -d --build
```

The `migrate` service applies migrations and seeds the configured owner before the API
starts. Open <http://localhost:8080>; the web container proxies `/api` and `/health` to
the API. Postgres is exposed on `localhost:5433`.

The profile uses the same `gymos-postgres` container name as the development database, so
stop the development stack first. `docker compose ... --profile app down` stops the full
stack; add `-v` to delete its data volume.

## One-time VM setup

### 1. Network

- Create an Oracle Cloud ARM VM (Ubuntu 24.04).
- Open SSH (22) in the VCN security list. Do **not** open 80, 443, or 6443.
- Optionally open UDP 41641 for direct Tailscale connections; Tailscale works without it
  through DERP relays.

### 2. K3s

```bash
curl -sfL https://get.k3s.io | sh -
```

K3s installs `kubectl`, the Traefik ingress controller, and the `local-path` storage class
used by the Postgres PVC.

### 3. Tailscale

Install Tailscale and join the VM with the server tag. The auth key must be created for
`tag:server` in the Tailscale admin console:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --auth-key=tskey-auth-replace-me
sudo tailscale set --ssh
sudo tailscale status
```

`tailscale set --ssh` enables Tailscale SSH. Note the MagicDNS name from `tailscale status`;
it becomes `DEPLOY_HOST`. Enable MagicDNS and HTTPS certificates for the tailnet in the
admin console; Tailscale Serve provisions the certificate for that name.

### 4. Checkout and cluster access

```bash
sudo mkdir -p /srv/gymos
sudo chown "$USER" /srv/gymos
git clone git@github.com:marculm/GymOS.git /srv/gymos

mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$USER" ~/.kube/config
chmod 600 ~/.kube/config
```

Add a read-only deploy key to the GitHub repository for the VM user. `deploy.sh` updates
this checkout with `git fetch origin main` and `git checkout --force --detach`; do not keep
local edits there.

### 5. Tailscale ACL and GitHub deployment access

Create a Tailscale OAuth client with the `tag:ci` tag. The tailnet ACL must allow the CI
tag to SSH into the VM as the deploy user:

```json
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"],
    "tag:server": ["autogroup:admin"]
  },
  "grants": [
    {
      "src": ["tag:ci"],
      "dst": ["tag:server"],
      "ip": ["tcp:22"]
    }
  ],
  "ssh": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["tag:server"],
      "users": ["ubuntu"]
    }
  ]
}
```

The `grants` rule is required in addition to the `ssh` rule; Tailscale SSH rules do not
grant network access by themselves. Replace `ubuntu` with the local account used by
`DEPLOY_USER`.

Add these GitHub repository secrets and variables:

| Kind | Name | Value |
| :-- | :-- | :-- |
| Secret | `TS_OAUTH_CLIENT_ID` | OAuth client ID |
| Secret | `TS_OAUTH_SECRET` | OAuth client secret |
| Variable | `DEPLOY_USER` | Unix user on the VM, e.g. `ubuntu` |
| Variable | `DEPLOY_HOST` | VM MagicDNS name |

The deploy job runs `tailscale ssh $DEPLOY_USER@$DEPLOY_HOST`; no SSH private key is stored
in GitHub.

### 6. Namespace and secret

```bash
kubectl apply -f /srv/gymos/deploy/k8s/namespace.yaml
cp /srv/gymos/deploy/k8s/secret.example.yaml /tmp/gymos-secret.yaml
# Edit /tmp/gymos-secret.yaml: password and the URL-encoded password in DATABASE_URL
kubectl apply -f /tmp/gymos-secret.yaml
rm /tmp/gymos-secret.yaml
```

The password in `POSTGRES_PASSWORD` and `DATABASE_URL` must match. URL-encode it inside
`DATABASE_URL` if it contains `@`, `:`, `/`, or `?`.

`GYMOS_USER_EMAIL` lives in `deploy/k8s/configmap.yaml`. Change it in git and merge before
the first deploy; `deploy.sh` applies the manifest on every deploy, so live edits are
overwritten. The migration Job seeds this owner idempotently.

### 7. GHCR visibility

The repository is private, so new GHCR packages start private. After the first `main`
pipeline, open each `gymos-api`, `gymos-web`, and `gymos-api-migrate` package in GitHub →
Package settings → Change visibility → Public. The VM then pulls anonymously.

### 8. Tailscale Serve

K3s Traefik already binds port 443, so Tailscale Serve uses 8443:

```bash
sudo tailscale serve --bg --https=8443 http://127.0.0.1:80
sudo tailscale serve status
```

Open `https://<DEPLOY_HOST>:8443` from any device in the tailnet. Tailscale terminates
TLS; Traefik only sees HTTP.

## Deploy and rollback

The pipeline deploys automatically after a merge to `main`. To deploy manually on the VM:

```bash
/srv/gymos/deploy/k8s/deploy.sh <commit-sha>
```

The script applies the manifests, runs migrations and the seed Job, rolls out the API and
web images pinned to that commit, and waits for both deployments.

Roll back by running the same script with an earlier commit:

```bash
/srv/gymos/deploy/k8s/deploy.sh <previous-sha>
```

Prisma migrations are forward-only. An older application image is safe only while the
current schema is backward compatible; after a destructive migration, restore a database
backup instead.

## Backup and restore

```bash
kubectl -n gymos exec postgres-0 -- pg_dump -U gymos gymos | gzip \
  > /srv/gymos-backup-$(date +%F).sql.gz

gunzip -c /srv/gymos-backup-YYYY-MM-DD.sql.gz \
  | kubectl -n gymos exec -i postgres-0 -- psql -U gymos gymos
```

Copy backups off the VM (for example over Tailscale) so they survive the VM.

## Troubleshooting

```bash
kubectl -n gymos get pods,svc,ingress
kubectl -n gymos logs deploy/gymos-api
kubectl -n gymos get events --sort-by=.lastTimestamp
tailscale status
tailscale serve status
curl -s http://127.0.0.1/health
```

`/prometheus` is deliberately not routed by the ingress. For debugging, use
`kubectl -n gymos port-forward svc/api 3000:3000` from the VM.

The K3s/Tailscale deploy path is unverified until the VM is provisioned; see
[`known-issues.md`](known-issues.md).
