/**
 * DMX 地址码计算工具
 *
 * DMX512 协议：每条 Universe 最多 512 个通道
 * 每台灯具占用连续通道，起始地址不重叠
 */

export interface DmxFixture {
  id: string
  name: string
  model?: string
  channels: number     // 通道数
  quantity: number     // 数量
  startAddress: number // 起始地址（计算得出）
  universe?: number    // 所属 Universe（1-based）
}

export interface DmxCalcResult {
  fixtures: DmxFixture[]
  totalChannels: number
  universesNeeded: number
  hasOverflow: boolean  // 是否超过 512 通道
  warnings: string[]
}

const DMX_MAX_CHANNELS = 512

/**
 * 计算 DMX 地址码分配
 * @param fixtures 灯具列表（不含 startAddress）
 * @param startFrom 起始地址（默认 1）
 * @returns 计算结果，含每台灯的起始地址
 */
export function calculateDmxAddresses(
  fixtures: Omit<DmxFixture, 'startAddress' | 'universe'>[],
  startFrom = 1,
): DmxCalcResult {
  const warnings: string[] = []
  let currentAddress = startFrom
  let currentUniverse = 1
  let totalChannels = 0

  const result: DmxFixture[] = fixtures.map(fixture => {
    const channelsNeeded = fixture.channels * fixture.quantity

    // 检查单台灯具通道数是否合法
    if (fixture.channels < 1 || fixture.channels > 512) {
      warnings.push(`${fixture.name}: 通道数 ${fixture.channels} 不合法（应为 1-512）`)
    }

    // 当前 Universe 是否还能容纳
    const addressInUniverse = ((currentAddress - 1) % DMX_MAX_CHANNELS) + 1
    if (addressInUniverse + fixture.channels - 1 > DMX_MAX_CHANNELS) {
      // 跳转到下一个 Universe
      currentUniverse += 1
      currentAddress = (currentUniverse - 1) * DMX_MAX_CHANNELS + 1
    }

    const fixtureWithAddress: DmxFixture = {
      ...fixture,
      startAddress: currentAddress,
      universe: Math.ceil(currentAddress / DMX_MAX_CHANNELS),
    }

    totalChannels += channelsNeeded
    currentAddress += channelsNeeded

    return fixtureWithAddress
  })

  const universesNeeded = Math.ceil(totalChannels / DMX_MAX_CHANNELS)
  const hasOverflow = (startFrom - 1 + totalChannels) > DMX_MAX_CHANNELS

  if (hasOverflow && universesNeeded <= 1) {
    warnings.push(`总通道数 ${totalChannels} 超过单 Universe 上限（512），建议拆分到多个 Universe`)
  }

  return { fixtures: result, totalChannels, universesNeeded, hasOverflow, warnings }
}

/**
 * 验证 DMX 地址是否有效
 */
export function isValidDmxAddress(address: number): boolean {
  return Number.isInteger(address) && address >= 1 && address <= 512
}

/**
 * 根据起始地址和通道数计算下一台灯的起始地址
 */
export function nextFixtureAddress(currentStart: number, channels: number): number {
  return currentStart + channels
}

/**
 * 检查地址列表是否有重叠
 */
export function checkAddressConflicts(
  fixtures: Pick<DmxFixture, 'name' | 'startAddress' | 'channels'>[],
): Array<{ fixture1: string; fixture2: string; conflictAddress: number }> {
  const conflicts: Array<{ fixture1: string; fixture2: string; conflictAddress: number }> = []

  for (let i = 0; i < fixtures.length; i++) {
    for (let j = i + 1; j < fixtures.length; j++) {
      const a = fixtures[i]
      const b = fixtures[j]
      const aEnd = a.startAddress + a.channels - 1
      const bEnd = b.startAddress + b.channels - 1

      if (a.startAddress <= bEnd && b.startAddress <= aEnd) {
        const conflictAddress = Math.max(a.startAddress, b.startAddress)
        conflicts.push({ fixture1: a.name, fixture2: b.name, conflictAddress })
      }
    }
  }

  return conflicts
}

/**
 * 常见灯具通道数预设
 */
export const FIXTURE_PRESETS: Array<{ model: string; channels: number }> = [
  { model: 'MAC Aura', channels: 28 },
  { model: 'MAC Viper', channels: 44 },
  { model: 'Robe Robin 600', channels: 24 },
  { model: 'Martin ERA 600', channels: 25 },
  { model: 'Sharpy 330', channels: 16 },
  { model: 'Par 64 LED', channels: 7 },
  { model: 'Strip Light RGB', channels: 3 },
  { model: 'Fresnel LED', channels: 5 },
  { model: 'Moving Head Wash', channels: 18 },
  { model: 'Moving Head Spot', channels: 20 },
  { model: 'Beam 200W', channels: 15 },
  { model: 'Pixel Bar', channels: 36 },
]
