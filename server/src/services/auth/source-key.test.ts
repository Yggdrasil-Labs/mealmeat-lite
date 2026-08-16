/**
 * 来源地址规范化单元测试 — 私有判定与规范化同源
 */
import { describe, expect, it } from 'vitest'
import { canonicalizeSourceAddress, isIpv4, isPrivateAddress } from './source-key.js'

describe('isIpv4', () => {
  it('接受合法 IPv4 并拒绝越界/畸形', () => {
    expect(isIpv4('10.0.0.1')).toBe(true)
    expect(isIpv4('010.0.0.1')).toBe(true)
    expect(isIpv4('255.255.255.255')).toBe(true)
    expect(isIpv4('256.0.0.1')).toBe(false)
    expect(isIpv4('1.2.3')).toBe(false)
    expect(isIpv4('1.2.3.4.5')).toBe(false)
    expect(isIpv4('abc')).toBe(false)
  })
})

describe('canonicalizeSourceAddress', () => {
  it('IPv4 归一化前导零', () => {
    expect(canonicalizeSourceAddress('010.0.0.1')).toBe('10.0.0.1')
    expect(canonicalizeSourceAddress('192.168.1.1')).toBe('192.168.1.1')
  })

  it('IPv4 映射的 IPv6 解包为 IPv4', () => {
    expect(canonicalizeSourceAddress('::ffff:10.0.0.1')).toBe('10.0.0.1')
    expect(canonicalizeSourceAddress('::ffff:192.168.001.1')).toBe('192.168.1.1')
  })

  it('IPv6 归一到 /64', () => {
    expect(canonicalizeSourceAddress('2001:db8:85a3::8a2e:370:7334')).toBe(
      '2001:0db8:85a3:0000:0:0:0:0',
    )
    expect(canonicalizeSourceAddress('::1')).toBe('0000:0000:0000:0000:0:0:0:0')
    expect(canonicalizeSourceAddress('::')).toBe('0000:0000:0000:0000:0:0:0:0')
  })

  it('去除 zone id 后规范化链路本地', () => {
    expect(canonicalizeSourceAddress('fe80::1%eth0')).toBe('fe80:0000:0000:0000:0:0:0:0')
  })

  it('拒绝非法输入', () => {
    expect(canonicalizeSourceAddress('1:2:3:4:5:6:7:8:9')).toBeNull()
    expect(canonicalizeSourceAddress('1::2::3')).toBeNull()
    expect(canonicalizeSourceAddress('::ffff:999.1.1.1')).toBeNull()
    expect(canonicalizeSourceAddress('not-an-ip')).toBeNull()
  })
})

describe('isPrivateAddress', () => {
  it('识别私有 IPv4', () => {
    expect(isPrivateAddress('10.0.0.1')).toBe(true)
    expect(isPrivateAddress('172.16.0.1')).toBe(true)
    expect(isPrivateAddress('172.31.255.255')).toBe(true)
    expect(isPrivateAddress('192.168.1.1')).toBe(true)
    expect(isPrivateAddress('127.0.0.1')).toBe(true)
    expect(isPrivateAddress('169.254.1.1')).toBe(true)
    expect(isPrivateAddress('010.0.0.1')).toBe(true)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
    expect(isPrivateAddress('172.32.0.1')).toBe(false)
  })

  it('识别 IPv4 映射的私网 IPv6（与 canonicalize 同源）', () => {
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true)
    expect(isPrivateAddress('::ffff:172.16.0.1')).toBe(true)
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false)
  })

  it('识别 IPv6 回环与链路本地（含 zone id）', () => {
    expect(isPrivateAddress('::1')).toBe(true)
    expect(isPrivateAddress('fe80::1')).toBe(true)
    expect(isPrivateAddress('fe80::1%eth0')).toBe(true)
  })

  it('识别 ULA 并拒绝公网 IPv6', () => {
    expect(isPrivateAddress('fd00::1')).toBe(true)
    expect(isPrivateAddress('fc00::1')).toBe(true)
    expect(isPrivateAddress('2001:db8::1')).toBe(false)
  })
})
