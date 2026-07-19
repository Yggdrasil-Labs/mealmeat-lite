/**
 * Docker 容器健康检查脚本
 * 用法: node dist/healthcheck.js live | node dist/healthcheck.js ready
 */
const mode = process.argv[2] ?? 'ready'
const port = process.env.PORT ?? '3000'
const url = `http://127.0.0.1:${port}/health/${mode}`

fetch(url)
  .then((res) => {
    if (res.ok) process.exit(0)
    process.exit(1)
  })
  .catch(() => process.exit(1))
