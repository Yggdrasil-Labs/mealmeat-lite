import { Hono } from 'hono'
import type { ModelCatalog } from '../services/models/model-catalog.js'

export interface ModelsRoutesDeps {
  getModelCatalog(): ModelCatalog
}

/** 模型目录公开端点：仅返回冻结 ModelListResponse 所允许的字段。 */
export function createModelsRoutes(deps: ModelsRoutesDeps): Hono {
  const routes = new Hono()
  routes.get('/models', (c) => c.json(deps.getModelCatalog().listPublic()))
  return routes
}
