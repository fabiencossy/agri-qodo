# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile pour le backend NestJS Agri Qodo.
# Cible : Railway (mais tourne sur n'importe quel hôte Docker).
#
# Étapes :
#   1. deps     → installe les deps via pnpm en isolant le workspace
#   2. builder  → compile NestJS et génère le client Prisma
#   3. runner   → image finale slim (~150 MB) avec uniquement le runtime

# -----------------------------------------------------------
# Stage 1 — installer les dépendances de tous les workspaces nécessaires
# -----------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Manifestes uniquement pour bénéficier du cache Docker.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/
COPY packages/domain/package.json packages/domain/
COPY packages/odoo-client/package.json packages/odoo-client/

RUN pnpm install --frozen-lockfile \
  --filter @agri-qodo/backend... \
  --filter @agri-qodo/domain \
  --filter @agri-qodo/odoo-client

# -----------------------------------------------------------
# Stage 2 — build (Prisma generate + nest build)
# -----------------------------------------------------------
FROM deps AS builder
WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/domain/ packages/domain/
COPY packages/odoo-client/ packages/odoo-client/
COPY apps/backend/ apps/backend/

# Build des packages workspace (CJS) puis du backend. odoo-client doit
# être buildé AVANT le backend car le backend l'importe en runtime via
# `dist/`.
RUN pnpm --filter @agri-qodo/domain build \
  && pnpm --filter @agri-qodo/odoo-client build \
  && pnpm --filter @agri-qodo/backend exec prisma generate \
  && pnpm --filter @agri-qodo/backend build

# -----------------------------------------------------------
# Stage 3 — runtime production
# -----------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable && corepack prepare pnpm@9.15.0 --activate

# Récupère le node_modules hoisté + les binaries (.bin, prisma engine)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/domain/package.json ./packages/domain/
COPY --from=builder /app/packages/odoo-client/dist ./packages/odoo-client/dist
COPY --from=builder /app/packages/odoo-client/package.json ./packages/odoo-client/

EXPOSE 3001

# Migration auto au démarrage : `prisma migrate deploy` est idempotent et
# n'exécute jamais de drop. Si la DB n'a pas l'extension PostGIS, le
# premier `migrate deploy` la créera (cf premier migration).
WORKDIR /app/apps/backend
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
