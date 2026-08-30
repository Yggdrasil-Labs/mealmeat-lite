# === Build stage ===
FROM node:24.20.0-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS build

RUN npm install --global corepack@0.35.0 \
    && corepack enable \
    && corepack prepare pnpm@11.17.0 --activate

WORKDIR /app

# Install dependencies with frozen lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build TypeScript (biome.json 在仓库根目录，build 只需 tsc 不需 lint)
COPY tsconfig.json tsconfig.build.json ./
COPY src/ src/
RUN pnpm build

# tsc 不复制非 TS 文件（.sql）；迁移目录是稳定 symlink，构建时解引用为完整 release。
RUN cp -rL src/db/migrations dist/db/migrations

# === Production stage ===
FROM node:24.20.0-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS production

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
