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
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/src/config/env.mts apps/api/src/config/env.mts
RUN bun --filter @gymos/api db:generate

FROM oven/bun:1.4.4-slim AS prod-deps

WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# @prisma/client lists TypeScript as an optional peer; the runtime does not need it.
RUN bun install --frozen-lockfile --production --linker hoisted --filter @gymos/api --omit=peer \
    && test ! -d node_modules/typescript

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
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated
COPY apps/api/src ./apps/api/src
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY packages/shared/src ./packages/shared/src

USER bun
EXPOSE 3000
CMD ["bun", "apps/api/src/index.mts"]
