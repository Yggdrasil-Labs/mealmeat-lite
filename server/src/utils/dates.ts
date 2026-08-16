/**
 * Asia/Shanghai 当前周周一 — 同步删除引用检查与服务端周计算共用
 */
export function currentWeekStartMonday(now: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.format(now).split('-').map(Number)
  const year = parts[0]
  const month = parts[1]
  const day = parts[2]
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('Failed to resolve Asia/Shanghai date')
  }
  const utcMidnight = Date.UTC(year, month - 1, day)
  const weekday = new Date(utcMidnight).getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  return new Date(utcMidnight - daysSinceMonday * 86_400_000).toISOString().slice(0, 10)
}
