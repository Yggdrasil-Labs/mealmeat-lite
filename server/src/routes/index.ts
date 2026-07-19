/**
 * API v1 路由聚合
 * 阶段 1+ 在此注册 chat, recipes, plans, settings, auth, sync 等路由
 */
import { Hono } from 'hono'

export const apiV1 = new Hono()
