/**
 * 功率/负荷计算工具
 *
 * 用于计算多回路灯具的总功率、电流、安全负载、断路器选型和电缆规格。
 * 适配单相 220V 与三相 380V 供电场景。
 */

export type PowerPhase = 'single' | 'three'

export interface PowerFixture {
  id: string
  name: string
  quantity: number
  powerW: number
  totalPower?: number
}

export interface PowerCircuit {
  id: string
  name: string
  fixtures: PowerFixture[]
  voltage?: number
  phase?: PowerPhase
  breakerA?: number
  cableLengthM?: number
}

export interface PowerCalcResult {
  totalPowerW: number
  totalPowerKW: number
  apparentPowerKVA: number
  currentA: number
  safeCurrentA: number
  recommendedBreakerA: number
  ratedBreakerA: number
  breakerLoadPercent: number
  isOverloaded: boolean
  safetyFactor: number
  powerFactor: number
  voltage: number
  phase: PowerPhase
  maxCircuitLoadPercent?: number
  overloadedCircuitCount?: number
  byCircuit?: CircuitResult[]
}

export interface CircuitResult {
  circuitId: string
  circuitName: string
  totalPowerW: number
  totalPowerKW: number
  currentA: number
  safeCurrentA: number
  recommendedBreakerA: number
  ratedBreakerA: number
  breakerLoadPercent: number
  isOverloaded: boolean
  voltage: number
  phase: PowerPhase
  cable?: CableCalcResult
}

export interface CableCalcResult {
  crossSectionMm2: number
  spec: string
  warning?: string
}

const BREAKER_SPECS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250]

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function selectBreaker(current: number): number {
  const suitable = BREAKER_SPECS.find(spec => spec >= current)
  return suitable ?? BREAKER_SPECS[BREAKER_SPECS.length - 1]
}

function calcCurrent(powerW: number, voltage: number, powerFactor: number, phase: PowerPhase): number {
  if (powerW <= 0 || voltage <= 0 || powerFactor <= 0) return 0
  const denominator = phase === 'three'
    ? Math.sqrt(3) * voltage * powerFactor
    : voltage * powerFactor
  return powerW / denominator
}

export function calcFixturePower(fixture: Omit<PowerFixture, 'totalPower'>): number {
  return fixture.quantity * fixture.powerW
}

/**
 * 计算总功率和负载（单回路或多灯具合并）。
 */
export function calcTotalPower(
  fixtures: Omit<PowerFixture, 'totalPower'>[],
  voltage = 220,
  safetyFactor = 0.8,
  powerFactor = 0.85,
  phase: PowerPhase = 'single',
  breakerA?: number,
): PowerCalcResult {
  const totalPowerW = fixtures.reduce((sum, fixture) => (
    sum + Math.max(fixture.quantity, 0) * Math.max(fixture.powerW, 0)
  ), 0)
  const currentA = calcCurrent(totalPowerW, voltage, powerFactor, phase)
  const safeCurrentA = safetyFactor > 0 ? currentA / safetyFactor : currentA
  const recommendedBreakerA = selectBreaker(safeCurrentA)
  const ratedBreakerA = breakerA && breakerA > 0 ? breakerA : recommendedBreakerA
  const breakerLoadPercent = ratedBreakerA > 0 ? (currentA / ratedBreakerA) * 100 : 0
  const isOverloaded = ratedBreakerA > 0 && currentA > ratedBreakerA * safetyFactor
  const apparentPowerKVA = powerFactor > 0 ? totalPowerW / powerFactor / 1000 : 0

  return {
    totalPowerW,
    totalPowerKW: round(totalPowerW / 1000),
    apparentPowerKVA: round(apparentPowerKVA),
    currentA: round(currentA),
    safeCurrentA: round(safeCurrentA),
    recommendedBreakerA,
    ratedBreakerA,
    breakerLoadPercent: round(breakerLoadPercent),
    isOverloaded,
    safetyFactor,
    powerFactor,
    voltage,
    phase,
  }
}

/**
 * 多回路分析。
 */
export function calcMultiCircuit(
  circuits: PowerCircuit[],
  safetyFactor = 0.8,
  powerFactor = 0.85,
): PowerCalcResult {
  const byCircuit: CircuitResult[] = circuits.map(circuit => {
    const voltage = circuit.voltage ?? (circuit.phase === 'three' ? 380 : 220)
    const phase = circuit.phase ?? (voltage >= 380 ? 'three' : 'single')
    const result = calcTotalPower(
      circuit.fixtures,
      voltage,
      safetyFactor,
      powerFactor,
      phase,
      circuit.breakerA,
    )

    return {
      circuitId: circuit.id,
      circuitName: circuit.name,
      totalPowerW: result.totalPowerW,
      totalPowerKW: result.totalPowerKW,
      currentA: result.currentA,
      safeCurrentA: result.safeCurrentA,
      recommendedBreakerA: result.recommendedBreakerA,
      ratedBreakerA: result.ratedBreakerA,
      breakerLoadPercent: result.breakerLoadPercent,
      isOverloaded: result.isOverloaded,
      voltage,
      phase,
      cable: circuit.cableLengthM && circuit.cableLengthM > 0
        ? calcCableCrossSection(result.safeCurrentA, circuit.cableLengthM, 5, voltage)
        : undefined,
    }
  })

  const totalPowerW = byCircuit.reduce((sum, circuit) => sum + circuit.totalPowerW, 0)
  const totalCurrentA = byCircuit.reduce((sum, circuit) => sum + circuit.currentA, 0)
  const safeCurrentA = safetyFactor > 0 ? totalCurrentA / safetyFactor : totalCurrentA
  const maxCircuitLoadPercent = byCircuit.reduce((max, circuit) => (
    Math.max(max, circuit.breakerLoadPercent)
  ), 0)
  const overloadedCircuitCount = byCircuit.filter(circuit => circuit.isOverloaded).length

  return {
    totalPowerW,
    totalPowerKW: round(totalPowerW / 1000),
    apparentPowerKVA: round(powerFactor > 0 ? totalPowerW / powerFactor / 1000 : 0),
    currentA: round(totalCurrentA),
    safeCurrentA: round(safeCurrentA),
    recommendedBreakerA: selectBreaker(safeCurrentA),
    ratedBreakerA: selectBreaker(safeCurrentA),
    breakerLoadPercent: round(maxCircuitLoadPercent),
    isOverloaded: overloadedCircuitCount > 0,
    safetyFactor,
    powerFactor,
    voltage: 220,
    phase: 'single',
    maxCircuitLoadPercent: round(maxCircuitLoadPercent),
    overloadedCircuitCount,
    byCircuit,
  }
}

/**
 * 计算电缆截面积（平方毫米）推荐规格。
 */
export function calcCableCrossSection(
  currentA: number,
  lengthM: number,
  voltageDrop = 5,
  voltage = 220,
): CableCalcResult {
  const resistivity = 0.0172
  const allowedDropV = (voltage * voltageDrop) / 100
  const requiredMm2 = allowedDropV > 0
    ? (2 * resistivity * lengthM * currentA) / allowedDropV
    : 0
  const standardSpecs = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
  const selected = standardSpecs.find(spec => spec >= requiredMm2) ?? 120

  const specs: Record<number, string> = {
    1.5: '1.5mm² (最大 16A)',
    2.5: '2.5mm² (最大 25A)',
    4: '4mm² (最大 32A)',
    6: '6mm² (最大 40A)',
    10: '10mm² (最大 63A)',
    16: '16mm² (最大 80A)',
    25: '25mm² (最大 100A)',
    35: '35mm² (最大 125A)',
    50: '50mm² (最大 160A)',
    70: '70mm² (最大 200A)',
    95: '95mm² (最大 250A)',
    120: '120mm²',
  }

  return {
    crossSectionMm2: selected,
    spec: specs[selected] ?? `${selected}mm²`,
    warning: requiredMm2 > 120 ? '所需截面积超出常规范围，建议分路供电' : undefined,
  }
}

/**
 * 常见灯具功率参考
 */
export const POWER_REFERENCES: Array<{ name: string; powerW: number }> = [
  { name: 'Moving Head Spot 330W', powerW: 330 },
  { name: 'Moving Head Wash 200W', powerW: 200 },
  { name: 'Moving Head Beam 260W', powerW: 260 },
  { name: 'Par LED 200W', powerW: 200 },
  { name: 'Par LED 100W', powerW: 100 },
  { name: 'Fresnel LED 150W', powerW: 150 },
  { name: 'Follow Spot 1200W', powerW: 1200 },
  { name: 'Strip Light LED 72W', powerW: 72 },
  { name: 'Profile Spot 150W', powerW: 150 },
  { name: 'Haze Machine 1500W', powerW: 1500 },
  { name: 'Fog Machine 1000W', powerW: 1000 },
]

export function calculatePower(fixtures: Omit<PowerFixture, 'totalPower'>[], voltage = 220): number {
  void voltage
  return fixtures.reduce((sum, fixture) => sum + fixture.quantity * fixture.powerW, 0)
}

export function calculateCurrent(powerW: number, voltage = 220): number {
  return round(powerW / voltage)
}

export function calculateCircuitLoad(fixtures: Omit<PowerFixture, 'totalPower'>[], voltage = 220) {
  return calcTotalPower(fixtures, voltage)
}

export interface PowerPreset {
  model: string
  powerW: number
  category: string
}

export const POWER_PRESETS: PowerPreset[] = [
  { model: 'Moving Head Spot 330W', powerW: 330, category: '摇头灯' },
  { model: 'Moving Head Wash 200W', powerW: 200, category: '摇头灯' },
  { model: 'Moving Head Beam 260W', powerW: 260, category: '摇头灯' },
  { model: 'Par LED 200W', powerW: 200, category: '帕灯' },
  { model: 'Par LED 100W', powerW: 100, category: '帕灯' },
  { model: 'Fresnel LED 150W', powerW: 150, category: '菲涅尔' },
  { model: 'Follow Spot 1200W', powerW: 1200, category: '追光灯' },
  { model: 'LED Strip 36W/m', powerW: 36, category: '线条灯' },
  { model: 'Haze Machine 1500W', powerW: 1500, category: '气氛机' },
  { model: 'Laser 3W RGB', powerW: 30, category: '激光' },
]
