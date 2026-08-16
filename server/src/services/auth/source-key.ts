/**
 * 客户端来源地址规范化 — 限流来源键与 XFF 信任判定共用同一套解析
 *
 * 不变量：isPrivateAddress 与 canonicalizeSourceAddress 必须同源——
 * 私有判定基于规范化结果，因此 ::ffff:x.x.x.x、::1、带 zone id 的链路本地地址
 * 与 IPv4 前导零都与规范路径一致，不会出现「能规范化却判不出私网」的裂缝。
 * Caddy 覆盖客户端 X-Forwarded-*；后端仅在直连对端为私有网络地址时
 * 信任 X-Forwarded-For 的首个地址。IPv4 使用完整地址，IPv6 归一到 /64。
 */
export function isIpv4(address: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address)
  if (match === null) return false
  return match.slice(1).every((octet) => Number(octet) <= 255)
}

/** 私有判定 = 先规范化再分类；无法规范化（非法输入）一律视为非私有。 */
export function isPrivateAddress(address: string): boolean {
  const canonical = canonicalizeSourceAddress(address)
  if (canonical === null) return false
  if (isIpv4(canonical)) return isPrivateIpv4(canonical)
  const groups = expandIpv6(canonical)
  if (groups === null) return false
  const first = Number.parseInt(groups[0] ?? '0', 16)
  if (first >= 0xfc00 && first <= 0xfdff) return true
  if (first >= 0xfe80 && first <= 0xfebf) return true
  return groups.every((group) => Number.parseInt(group, 16) === 0)
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  const first = octets[0] ?? 0
  const second = octets[1] ?? 0
  if (first === 10 || first === 127) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  if (first === 169 && second === 254) return true
  return false
}

/** 规范化来源地址；无法识别时返回 null。IPv4 归一化前导零。 */
export function canonicalizeSourceAddress(address: string): string | null {
  const zoneStripped = address.split('%')[0] ?? ''
  if (isIpv4(zoneStripped)) {
    return zoneStripped
      .split('.')
      .map((octet) => String(Number(octet)))
      .join('.')
  }
  if (!zoneStripped.includes(':')) return null

  const v4Mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(zoneStripped)
  if (v4Mapped?.[1] !== undefined && isIpv4(v4Mapped[1])) {
    return v4Mapped[1]
      .split('.')
      .map((octet) => String(Number(octet)))
      .join('.')
  }

  const groups = expandIpv6(zoneStripped)
  if (groups === null) return null
  return `${groups
    .slice(0, 4)
    .map((group) => group.padStart(4, '0'))
    .join(':')}:0:0:0:0`
}

function expandIpv6(address: string): string[] | null {
  const parts = address.split('::')
  if (parts.length > 2) return null
  const head = (parts[0] ?? '').split(':').filter((group) => group.length > 0)
  const tail =
    parts.length === 2 ? (parts[1] ?? '').split(':').filter((group) => group.length > 0) : []
  const missing = 8 - head.length - tail.length
  if (missing < 0) return null
  const groups = [...head, ...Array.from({ length: missing }, () => '0'), ...tail]
  if (groups.length !== 8) return null
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null
  return groups
}
