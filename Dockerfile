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

RUN mkdir -p storage/uploads && chown -R node:node /app
USER node
EXPOSE 4000

# Apply pending migrations, then start. (Seed is a one-off — see DEPLOY.md.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
