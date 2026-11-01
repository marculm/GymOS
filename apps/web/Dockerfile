FROM oven/bun:1.4.4-slim AS builder

WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --linker hoisted

COPY tsconfig.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN bun --filter @gymos/web build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
