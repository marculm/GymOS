#!/usr/bin/env bash
set -euo pipefail

SHA="${1:?usage: deploy.sh <commit-sha>}"
REPO_DIR="${REPO_DIR:-/srv/gymos}"
NAMESPACE="${NAMESPACE:-gymos}"
REGISTRY="${REGISTRY:-ghcr.io/marculm}"
TAG="sha-${SHA}"

cd "$REPO_DIR"
git fetch origin main
git checkout --force --detach "$SHA"

kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/postgres.yaml

kubectl delete job gymos-migrate -n "$NAMESPACE" --ignore-not-found
sed "s|__IMAGE_API_MIGRATE__|$REGISTRY/gymos-api-migrate:$TAG|g" deploy/k8s/migrate-job.yaml | kubectl apply -f -
kubectl wait --for=condition=complete --timeout=600s job/gymos-migrate -n "$NAMESPACE"

sed "s|__IMAGE_API__|$REGISTRY/gymos-api:$TAG|g" deploy/k8s/api.yaml | kubectl apply -f -
sed "s|__IMAGE_WEB__|$REGISTRY/gymos-web:$TAG|g" deploy/k8s/web.yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/ingress.yaml

kubectl rollout status deployment/gymos-api -n "$NAMESPACE" --timeout=600s
kubectl rollout status deployment/gymos-web -n "$NAMESPACE" --timeout=600s
