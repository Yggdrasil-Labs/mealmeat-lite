# === Build stage ===
# TODO: 发布前执行 `docker pull node:22.22.3-slim` 获取真实 sha256 digest 替换 placeholder
FROM node:22.22.3-slim@sha256:placeholder AS build

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# Install dependencies with frozen lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build TypeScript (biome.json 在仓库根目录，build 只需 tsc 不需 lint)
COPY tsconfig.json ./
COPY src/ src/
RUN pnpm build

# === Production stage ===
# TODO: 与 build 阶段使用相同的真实 digest
FROM node:22.22.3-slim@sha256:placeholder AS production

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

ENTRYPOINT ["node", "dist/index.js"]
