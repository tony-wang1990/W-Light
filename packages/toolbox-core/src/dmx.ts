/**
 * DMX 地址码计算工具
 *
 * DMX512 协议：每条 Universe 最多 512 个通道。
 * 现场常见诉求包括连续自动分配、手动固定地址、多 Universe 分链和冲突检查。
 */

export interface DmxFixture {
  id: string
  name: string
  model?: string
  channels: number
  quantity: number
  startAddress: number
  endAddress?: number
  universe?: number
  assignmentIds?: string[]
}

export type DmxFixtureInput = Omit<
  DmxFixture,
  'startAddress' | 'endAddress' | 'universe' | 'assignmentIds'
> & {
  startAddress?: number
  universe?: number
}

export interface DmxAddressAssignment {
  id: string
  fixtureId: string
  fixtureName: string
  label: string
  index: number
  channels: number
  universe: number
  startAddress: number
  endAddress: number
}

export interface DmxAddressConflict {
  universe: number
  fixtureA: string
  fixtureB: string
  addressStart: number
  addressEnd: number
}

export interface DmxUniverseUsage {
  universe: number
  usedChannels: number
  utilization: number
  firstAddress: number
  lastAddress: number
}

export interface DmxCalcResult {
  fixtures: DmxFixture[]
  assignments: DmxAddressAssignment[]
  totalChannels: number
  universesNeeded: number
  hasOverflow: boolean
  hasConflicts: boolean
  conflicts: DmxAddressConflict[]
  universeUsage: DmxUniverseUsage[]
  warnings: string[]
}

const DMX_MAX_CHANNELS = 512

function normalizeAddress(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value as number), 1), DMX_MAX_CHANNELS)
}

function normalizeUniverse(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(Math.floor(value as number), 1)
}

function advanceCursor(universe: number, address: number, channels: number) {
  const nextAddress = address + channels
  if (nextAddress > DMX_MAX_CHANNELS) {
    return { universe: universe + 1, address: 1 }
  }
  return { universe, address: nextAddress }
}

function buildUniverseUsage(assignments: DmxAddressAssignment[]): DmxUniverseUsage[] {
  const occupied = new Map<number, Set<number>>()

  assignments.forEach(assignment => {
    const channels = occupied.get(assignment.universe) ?? new Set<number>()
    for (let channel = assignment.startAddress; channel <= assignment.endAddress; channel += 1) {
      channels.add(channel)
    }
    occupied.set(assignment.universe, channels)
  })

  return Array.from(occupied.entries())
    .map(([universe, channels]) => {
      const sorted = Array.from(channels.values()).sort((a, b) => a - b)
      const usedChannels = sorted.length

      return {
        universe,
        usedChannels,
        utilization: Math.round((usedChannels / DMX_MAX_CHANNELS) * 100),
        firstAddress: sorted[0] ?? 0,
        lastAddress: sorted[sorted.length - 1] ?? 0,
      }
    })
    .sort((a, b) => a.universe - b.universe)
}

function findAddressConflicts(assignments: DmxAddressAssignment[]): DmxAddressConflict[] {
  const conflicts: DmxAddressConflict[] = []

  for (let i = 0; i < assignments.length; i += 1) {
    for (let j = i + 1; j < assignments.length; j += 1) {
      const a = assignments[i]
      const b = assignments[j]
      if (a.universe !== b.universe) continue

      const addressStart = Math.max(a.startAddress, b.startAddress)
      const addressEnd = Math.min(a.endAddress, b.endAddress)

      if (addressStart <= addressEnd) {
        conflicts.push({
          universe: a.universe,
          fixtureA: a.label,
          fixtureB: b.label,
          addressStart,
          addressEnd,
        })
      }
    }
  }

  return conflicts
}

/**
 * 计算 DMX 地址码分配。
 *
 * 支持：
 * - 连续自动分配
 * - 每组灯具指定 Universe
 * - 每组灯具固定起始地址
 * - 数量展开为逐台地址段
 */
export function calculateDmxAddresses(
  fixtures: DmxFixtureInput[],
  startFrom = 1,
): DmxCalcResult {
  const warnings: string[] = []
  const assignments: DmxAddressAssignment[] = []
  const resultFixtures: DmxFixture[] = []

  let cursorUniverse = 1
  let cursorAddress = normalizeAddress(startFrom, 1)
  let totalChannels = 0

  fixtures.forEach(fixture => {
    const requestedChannels = Math.floor(fixture.channels)
    const requestedQuantity = Math.floor(fixture.quantity)
    const channels = Math.min(Math.max(requestedChannels, 1), DMX_MAX_CHANNELS)
    const quantity = Math.max(requestedQuantity, 0)
    const assignmentIds: string[] = []

    if (requestedChannels < 1 || requestedChannels > DMX_MAX_CHANNELS) {
      warnings.push(`${fixture.name}: 通道数 ${fixture.channels} 不合法，已按 1-512 范围修正`)
    }
    if (requestedQuantity < 1) {
      warnings.push(`${fixture.name}: 数量 ${fixture.quantity} 不合法，已跳过地址展开`)
    }

    const hasManualUniverse = Number.isFinite(fixture.universe)
    const hasManualStart = Number.isFinite(fixture.startAddress)
    let unitUniverse = hasManualUniverse
      ? normalizeUniverse(fixture.universe, cursorUniverse)
      : cursorUniverse
    let unitAddress = hasManualStart
      ? normalizeAddress(fixture.startAddress, cursorAddress)
      : hasManualUniverse && unitUniverse !== cursorUniverse
        ? 1
        : cursorAddress

    for (let index = 1; index <= quantity; index += 1) {
      if (unitAddress + channels - 1 > DMX_MAX_CHANNELS) {
        warnings.push(`${fixture.name} #${index}: U${unitUniverse}/${unitAddress} 容纳不下 ${channels}ch，已移到下一条 Universe`)
        unitUniverse += 1
        unitAddress = 1
      }

      const assignment: DmxAddressAssignment = {
        id: `${fixture.id}-${index}`,
        fixtureId: fixture.id,
        fixtureName: fixture.name,
        label: quantity > 1 ? `${fixture.name} #${index}` : fixture.name,
        index,
        channels,
        universe: unitUniverse,
        startAddress: unitAddress,
        endAddress: unitAddress + channels - 1,
      }

      assignments.push(assignment)
      assignmentIds.push(assignment.id)
      totalChannels += channels

      const nextCursor = advanceCursor(unitUniverse, unitAddress, channels)
      unitUniverse = nextCursor.universe
      unitAddress = nextCursor.address
    }

    const firstAssignment = assignments.find(assignment => assignment.fixtureId === fixture.id)
    const lastAssignment = [...assignments].reverse().find(assignment => assignment.fixtureId === fixture.id)

    resultFixtures.push({
      ...fixture,
      channels,
      quantity,
      startAddress: firstAssignment?.startAddress ?? unitAddress,
      endAddress: lastAssignment?.endAddress,
      universe: firstAssignment?.universe ?? unitUniverse,
      assignmentIds,
    })

    cursorUniverse = unitUniverse
    cursorAddress = unitAddress
  })

  const sortedAssignments = assignments.sort((a, b) => (
    a.universe - b.universe
    || a.startAddress - b.startAddress
    || a.label.localeCompare(b.label)
  ))
  const conflicts = findAddressConflicts(sortedAssignments)
  const universeUsage = buildUniverseUsage(sortedAssignments)
  const maxUniverse = Math.max(1, ...sortedAssignments.map(assignment => assignment.universe))
  const hasOverflow = maxUniverse > 1

  if (hasOverflow) {
    warnings.push(`地址分配已跨 ${maxUniverse} 条 Universe，请确认控台输出/节点配置一致`)
  }

  return {
    fixtures: resultFixtures,
    assignments: sortedAssignments,
    totalChannels,
    universesNeeded: maxUniverse,
    hasOverflow,
    hasConflicts: conflicts.length > 0,
    conflicts,
    universeUsage,
    warnings,
  }
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
  fixtures: Array<Pick<DmxFixture, 'name' | 'startAddress' | 'channels'> & {
    endAddress?: number
    universe?: number
  }>,
): Array<{ fixture1: string; fixture2: string; conflictAddress: number; universe: number }> {
  const assignments = fixtures.map((fixture, index) => ({
    id: `${fixture.name}-${index}`,
    fixtureId: `${fixture.name}-${index}`,
    fixtureName: fixture.name,
    label: fixture.name,
    index: 1,
    channels: fixture.channels,
    universe: fixture.universe ?? 1,
    startAddress: fixture.startAddress,
    endAddress: fixture.endAddress ?? fixture.startAddress + fixture.channels - 1,
  }))

  return findAddressConflicts(assignments).map(conflict => ({
    fixture1: conflict.fixtureA,
    fixture2: conflict.fixtureB,
    conflictAddress: conflict.addressStart,
    universe: conflict.universe,
  }))
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
