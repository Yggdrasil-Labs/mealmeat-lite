# === Build stage ===
FROM node:26.5.0-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS build

RUN npm install --global corepack@0.35.0 \
    && corepack enable \
    && corepack prepare pnpm@11.17.0 --activate

WORKDIR /app

# Install dependencies with frozen lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build TypeScript (biome.json 在仓库根目录，build 只需 tsc 不需 lint)
COPY tsconfig.json ./
COPY src/ src/
RUN pnpm build

# tsc 不复制非 TS 文件（.sql），需手动拷贝 migration SQL 到 dist/
RUN cp -r src/db/migrations dist/db/migrations

# === Production stage ===
FROM node:26.5.0-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS production

# tini 作为 PID 1 — 正确处理 SIGTERM 信号转发和 zombie 进程回收
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global corepack@0.35.0 \
    && corepack enable \
    && corepack prepare pnpm@11.17.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
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
