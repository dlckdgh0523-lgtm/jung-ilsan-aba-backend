# syntax=docker/dockerfile:1
# 정지은 일산 ABA — backend image (NestJS + Prisma + sharp).
# Debian-slim base (not alpine): sharp + Prisma engines use prebuilt glibc binaries.

# ---- builder: install all deps, generate Prisma client, compile TS ----
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runner: full node_modules retained so `prisma migrate deploy` + seed work in-container ----
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig*.json ./

# Only the writable upload dir needs `node` ownership — node_modules/dist/prisma stay
# root-owned but world-readable (avoids a slow recursive chown over all of node_modules).
RUN mkdir -p storage/uploads && chown -R node:node /app/storage
USER node
EXPOSE 4000

# Apply pending migrations, then start. (Seed is a one-off — see DEPLOY.md.)
# Content seed is empty-tables-only + idempotent, so booting with it is safe;
# `|| echo` keeps a transient seed failure from blocking the server start.
CMD ["sh", "-c", "npx prisma migrate deploy && (npm run db:seed:content || echo 'content seed skipped') && node dist/main.js"]
