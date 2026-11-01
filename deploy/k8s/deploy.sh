#!/usr/bin/env bash
set -euo pipefail

SHA="${1:?usage: deploy.sh <commit-sha>}"
REPO_DIR="${REPO_DIR:-/srv/gymos}"
REGISTRY="${REGISTRY:-ghcr.io/marculm}"
TAG="sha-${SHA}"

cd "$REPO_DIR"
git fetch origin main
git checkout --force --detach "$SHA"

kubectl apply -f deploy/k8s/namespace.yaml
if ! kubectl -n gymos get secret gymos-secrets >/dev/null 2>&1; then
  echo "Missing Secret gymos-secrets in namespace gymos. See docs/deployment.md." >&2
  exit 1
fi
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/postgres.yaml
kubectl rollout status statefulset/postgres -n gymos --timeout=300s

kubectl delete job gymos-migrate -n gymos --ignore-not-found
sed "s|__IMAGE_API_MIGRATE__|$REGISTRY/gymos-api-migrate:$TAG|g" deploy/k8s/migrate-job.yaml | kubectl apply -f -
if ! kubectl wait --for=condition=complete --timeout=600s job/gymos-migrate -n gymos; then
  kubectl -n gymos logs job/gymos-migrate --tail=100 || true
  exit 1
fi

sed "s|__IMAGE_API__|$REGISTRY/gymos-api:$TAG|g" deploy/k8s/api.yaml | kubectl apply -f -
sed "s|__IMAGE_WEB__|$REGISTRY/gymos-web:$TAG|g" deploy/k8s/web.yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/ingress.yaml

kubectl rollout status deployment/gymos-api -n gymos --timeout=600s
kubectl rollout status deployment/gymos-web -n gymos --timeout=600s
