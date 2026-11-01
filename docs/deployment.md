# Deployment

GymOS runs on a single Oracle Cloud ARM VM with K3s. The VM is reached only through
Tailscale; no HTTP port is open to the internet. Images are built by GitHub Actions and
published as public GHCR packages (ADR-0035).

## Pipeline

Pull requests run `checks` and `infra`. A push to `main` runs both and then publishes
images. The deploy job is part of the same workflow but is skipped for pushes; it runs only
in a manual CI run with the `deploy` input enabled:

1. `checks` — typecheck, lint, tests against a Postgres service, web build.
2. `infra` — actionlint, kubeconform, and shellcheck for workflows, manifests, and the
   deploy script.
3. `images` — builds `linux/arm64` images and pushes them to GHCR:
   - `ghcr.io/marculm/gymos-api:sha-<commit>`
   - `ghcr.io/marculm/gymos-web:sha-<commit>`
   - `ghcr.io/marculm/gymos-api-migrate:sha-<commit>`
4. `deploy` — only in a manual run on `main` with `deploy` enabled: joins the tailnet as an
   ephemeral `tag:ci` node and runs `/srv/gymos/deploy/k8s/deploy.sh <sha>` on the VM over
   Tailscale SSH.

To deploy, open **Actions → CI → Run workflow**, select `main`, and enable `deploy`. The
manual run repeats checks, infrastructure lint, and image publishing for the selected ref,
then deploys its commit SHA. A push to `main` never deploys.

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

The Compose URLs interpolate `POSTGRES_PASSWORD` directly. Use a URL-safe password, or
URL-encode it in both `DATABASE_URL` values if it contains `@`, `:`, `/`, or `?`.

## One-time VM setup

### 1. Network

- Create an Oracle Cloud ARM VM (Ubuntu 24.04).
- Open SSH (22) only temporarily and restrict the source to your admin IP. Do **not** open
  80, 443, or 6443.
- After Tailscale SSH works (step 3), remove the temporary SSH rule; the deploy path does
  not use port 22. Optionally disable OpenSSH. If the rule is removed before Tailscale is
  working, use the Oracle Cloud Shell or serial console.
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

### 4. Deploy key, checkout, and cluster access

Generate a deploy key on the VM and add its public key as a **read-only deploy key** in
the GitHub repository (Settings → Deploy keys) before cloning:

```bash
ssh-keygen -t ed25519 -C gymos-deploy -f ~/.ssh/gymos_deploy -N ""
cat ~/.ssh/gymos_deploy.pub

printf 'Host github.com\n  IdentityFile ~/.ssh/gymos_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
ssh -T git@github.com
# Expect: "successfully authenticated, but GitHub does not provide shell access."
```

If `~/.ssh/config` already has a `github.com` block, merge the `IdentityFile` line instead
of appending a duplicate block. Then check out the repository and configure kubectl:

```bash
sudo mkdir -p /srv/gymos
sudo chown "$USER" /srv/gymos
git clone git@github.com:marculm/GymOS.git /srv/gymos

mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$USER" ~/.kube/config
chmod 600 ~/.kube/config
```

`deploy.sh` updates this checkout with `git fetch origin main` and
`git checkout --force --detach`; do not keep local edits there.

### 5. Tailscale ACL and GitHub deployment access

Create a Tailscale OAuth client with the `tag:ci` tag and the writable `auth_keys` scope.
The tailnet ACL must allow CI SSH and the phone to reach the app:

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
    },
    {
      "src": ["autogroup:member"],
      "dst": ["tag:server"],
      "ip": ["tcp:22", "tcp:8443"]
    }
  ],
  "ssh": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["tag:server"],
      "users": ["ubuntu"]
    },
    {
      "action": "accept",
      "src": ["autogroup:member"],
      "dst": ["tag:server"],
      "users": ["ubuntu"]
    }
  ]
}
```

This is a **complete policy**; a full policy replaces Tailscale's default allow-all, so
only the listed grants work. `autogroup:member` covers your own devices (including the
phone); the `tcp:8443` grant is what lets the phone open the app, and `tcp:22` allows
interactive SSH. The `grants` rules are required in addition to the `ssh` rules; Tailscale
SSH rules do not grant network access by themselves. Replace `ubuntu` with the local
account used by `DEPLOY_USER`, and add other sources if more devices need access.

Add these GitHub repository secrets and variables:

| Kind | Name | Value |
| :-- | :-- | :-- |
| Secret | `TS_OAUTH_CLIENT_ID` | OAuth client ID |
| Secret | `TS_OAUTH_SECRET` | OAuth client secret |
| Variable | `DEPLOY_USER` | Unix user on the VM, e.g. `ubuntu` |
| Variable | `DEPLOY_HOST` | VM MagicDNS name |

The Deploy job runs `tailscale ssh $DEPLOY_USER@$DEPLOY_HOST`; no SSH private key is stored
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

### 7. GHCR visibility and first deploy

The repository is private, so new GHCR packages start private. Merge to `main` and let the
automatic `images` job finish, then make the packages public:

1. Open each `gymos-api`, `gymos-web`, and `gymos-api-migrate` package in GitHub →
   Package settings → Change visibility → Public.
2. Open **Actions → CI → Run workflow**, select `main`, and enable `deploy`.

If the deploy starts before the packages are public, the migrate Job fails at the image
pull. Make the packages public and run the manual workflow again; the migrate pod never
started, so no database changes occurred.

### 8. Tailscale Serve

K3s Traefik already binds port 443, so Tailscale Serve uses 8443:

```bash
sudo tailscale serve --bg --https=8443 http://127.0.0.1:80
sudo tailscale serve status
```

Open `https://<DEPLOY_HOST>:8443` from any device in the tailnet. This only works when the
ACL grant from step 5 is in place. Tailscale terminates TLS; Traefik only sees HTTP.

## Deploy and rollback

Deployment is manual. Open **Actions → CI → Run workflow**, select `main`, and enable
`deploy`. The run repeats checks, infrastructure lint, and image publishing, then deploys
the selected ref's commit SHA. The deploy job is serialized by a concurrency group.

To run the deploy on the VM directly:

```bash
/srv/gymos/deploy/k8s/deploy.sh <commit-sha>
```

The script checks that the secret exists, waits for Postgres, runs migrations and the seed
Job, rolls out the API and web images pinned to that commit, and waits for both
deployments. It uses `ghcr.io/marculm` by default; the deploy job passes
`REGISTRY=ghcr.io/<owner>`. Set `REGISTRY` for manual deploys if the repository owner
differs.

For rollback, run the script on the VM with an earlier commit (the manual workflow deploys
the selected ref, not an arbitrary older commit):

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

- **ImagePullBackOff or 403 from GHCR:** the packages are still private, or the `images`
  job has not published that SHA yet. Make them public (step 7) or wait for CI, then run
  the manual workflow again.
- **Deploy is skipped:** the deploy job only runs for a manual `workflow_dispatch` run on
  `main` with the `deploy` input enabled. A push to `main` never deploys.
- **Deploy job fails at the Tailscale action:** the OAuth client needs the writable
  `auth_keys` scope and the `tag:ci` tag; check the ACL and the two repository secrets.
- **Phone cannot open `:8443`:** the ACL needs a grant from the phone's source
  (`autogroup:member`) to `tag:server` on `tcp:8443`, and `tailscale serve status` must
  show the HTTPS handler.
- **Migration Job timeout:** `kubectl -n gymos logs job/gymos-migrate` shows the Prisma
  error; the deploy script prints the last 100 lines on failure.

The K3s/Tailscale deploy path is unverified until the VM is provisioned; see
[`known-issues.md`](known-issues.md).
