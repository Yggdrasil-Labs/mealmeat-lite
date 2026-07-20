# === Build stage ===
FROM node:22.22.3-slim@sha256:16d364eebf6b62da439dc993d9b80940c78b0ca38438452f011ab9a25c752644 AS build

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# Install dependencies with frozen lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build TypeScript (biome.json 在仓库根目录，build 只需 tsc 不需 lint)
COPY tsconfig.json ./
COPY src/ src/
RUN pnpm build

# tsc 不复制非 TS 文件（.sql），需手动拷贝 migration SQL 到 dist/
RUN cp -r src/db/migrations dist/db/migrations

# === Production stage ===
FROM node:22.22.3-slim@sha256:16d364eebf6b62da439dc993d9b80940c78b0ca38438452f011ab9a25c752644 AS production

# tini 作为 PID 1 — 正确处理 SIGTERM 信号转发和 zombie 进程回收
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/dist ./dist

# Non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser

EXPOSE 3000

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
