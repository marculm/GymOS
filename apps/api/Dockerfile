FROM oven/bun:1.4.4-slim AS builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --linker hoisted

COPY apps/api/prisma apps/api/prisma
RUN bun --filter @gymos/api db:generate

FROM oven/bun:1.4.4-slim AS prod-deps

WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --production --linker hoisted

FROM oven/bun:1.4.4-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json /app/bun.lock ./
COPY --from=prod-deps /app/apps/api/package.json ./apps/api/
COPY --from=prod-deps /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/api/src ./apps/api/src
COPY packages/shared/src ./packages/shared/src

USER bun
EXPOSE 3000
CMD ["bun", "apps/api/src/index.mts"]

FROM builder AS migrate

WORKDIR /app
CMD ["bun", "--filter", "@gymos/api", "db:migrate:deploy"]
