/**
 * Hono 应用组装 — createApp 依赖注入，测试可替换 config/db/hasher/clock/source
 */
import { readFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { type Context, Hono } from 'hono'
import { type AppConfig, ConfigError, loadAppConfig } from './config.js'
import { createDb, type Db } from './db/pool.js'
import { createDeviceAuth } from './middleware/device-auth.js'
import { onError } from './middleware/on-error.js'
import { onNotFound } from './middleware/on-not-found.js'
import './middleware/context-variables.js'
import { requestId } from './middleware/request-id.js'
import { createAuthRoutes } from './routes/auth.js'
import { createChatRoutes } from './routes/chat.js'
import { healthRoutes } from './routes/health.js'
import { createApiV1 } from './routes/index.js'
import { createModelsRoutes } from './routes/models.js'
import { createSyncRoutes } from './routes/sync.js'
import type { PasswordHasher } from './security/passwords.js'
import { AuthService } from './services/auth/auth-service.js'
import { canonicalizeSourceAddress, isPrivateAddress } from './services/auth/source-key.js'
import { ChatRuntime, type ChatRuntimeTiming } from './services/chat/chat-runtime.js'
import { type ChatProvider, OpenAiCompatibleProvider } from './services/chat/provider-adapter.js'
import { SyncService } from './services/sync/sync-service.js'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
  version: string
}

export interface AppDeps {
  getConfig(): AppConfig
  getDb(): Db
  hasher?: PasswordHasher
  clock?: () => Date
  resolveSource?(c: Context): string | null
  chatProvider?: ChatProvider
  chatTiming?: Partial<ChatRuntimeTiming>
}

/** 默认来源解析：直连对端为私有网络地址时才信任 Caddy 覆盖后的 X-Forwarded-For。 */
export function defaultResolveSource(c: Context): string | null {
  const env = c.env as { incoming?: IncomingMessage }
  const direct = env.incoming?.socket?.remoteAddress
  if (direct === undefined) return null
  const forwarded = c.req.header('x-forwarded-for')
  if (isPrivateAddress(direct) && forwarded !== undefined) {
    const first = forwarded.split(',')[0]?.trim()
    if (first !== undefined && first !== '') {
      const canonical = canonicalizeSourceAddress(first)
      if (canonical !== null) return canonical
    }
  }
  return canonicalizeSourceAddress(direct)
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()
  app.use('*', requestId())

  const authService = new AuthService(deps)
  const syncService = new SyncService(deps)
  const deviceAuth = createDeviceAuth(deps)
  const resolveSource = deps.resolveSource ?? defaultResolveSource
  const modelCatalog = () => {
    const catalog = deps.getConfig().modelCatalog
    if (catalog === undefined) throw new ConfigError(['MEALMATE_MODELS_FILE'])
    return catalog
  }
  const chatRuntime = new ChatRuntime({
    getDb: deps.getDb,
    getModelCatalog: modelCatalog,
    provider: deps.chatProvider ?? new OpenAiCompatibleProvider(),
    timing: deps.chatTiming,
  })

  app.route('/health', healthRoutes)
  app.route(
    '/api/v1',
    createApiV1({
      authRoutes: createAuthRoutes({ auth: authService, deviceAuth, resolveSource }),
      syncRoutes: createSyncRoutes({ sync: syncService, deviceAuth }),
      modelsRoutes: createModelsRoutes({ getModelCatalog: modelCatalog }),
      chatRoutes: createChatRoutes({ chat: chatRuntime, deviceAuth }),
    }),
  )
  app.get('/', (c) => c.json({ name: 'mealmate-lite', version: pkg.version }))

  app.onError(onError)
  app.notFound(onNotFound)
  return app
}

function memoize<T>(factory: () => T): () => T {
  let cached: T | undefined
  let initialized = false
  return () => {
    if (!initialized) {
      cached = factory()
      initialized = true
    }
    return cached as T
  }
}

const defaultDeps: AppDeps = {
  getConfig: memoize(() => loadAppConfig(process.env)),
  getDb: memoize(() => createDb()),
}

/** 生产/集成默认应用；依赖在首次 /api/v1 请求时惰性解析。 */
export const app = createApp(defaultDeps)

/** 启动时 fail-fast：无效配置立即退出，不进入业务流量。 */
export function initializeRuntimeDeps(): void {
  defaultDeps.getConfig()
  defaultDeps.getDb()
}
