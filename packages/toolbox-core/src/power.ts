/**
 * 功率/负荷计算工具
 *
 * 用于计算多回路灯具的总功率、电流和安全负载
 * 适配单相 220V 和三相 380V 供电系统
 */

export interface PowerFixture {
  id: string
  name: string
  quantity: number
  powerW: number        // 单台功率（瓦）
  totalPower?: number   // 总功率（自动计算）
}

export interface PowerCircuit {
  id: string
  name: string
  fixtures: PowerFixture[]
  voltage?: number     // 回路电压（默认220V）
}

export interface PowerCalcResult {
  totalPowerW: number         // 总功率（瓦）
  totalPowerKW: number        // 总功率（千瓦）
  currentA: number            // 工作电流（安培）
  safeCurrentA: number        // 安全电流（安培，含安全系数）
  recommendedBreakerA: number // 推荐断路器规格（安培）
  isOverloaded: boolean       // 是否超负荷
  safetyFactor: number        // 安全系数
  powerFactor: number         // 功率因数
  byCircuit?: CircuitResult[] // 按回路分析
}

export interface CircuitResult {
  circuitId: string
  circuitName: string
  totalPowerW: number
  currentA: number
  safeCurrentA: number
  isOverloaded: boolean
}

// 常用断路器规格（安培）
const BREAKER_SPECS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250]

/**
 * 选择合适的断路器规格
 */
function selectBreaker(current: number): number {
  const suitable = BREAKER_SPECS.find(spec => spec >= current)
  return suitable ?? BREAKER_SPECS[BREAKER_SPECS.length - 1]
}

/**
 * 计算单个灯具组的功率
 */
export function calcFixturePower(fixture: Omit<PowerFixture, 'totalPower'>): number {
  return fixture.quantity * fixture.powerW
}

/**
 * 计算总功率和负载（单回路或多灯具合并）
 * @param fixtures 灯具列表
 * @param voltage 电压（V），默认 220V
 * @param safetyFactor 安全系数，默认 0.8（即额定电流的 80%）
 * @param powerFactor 功率因数，默认 0.85
 */
export function calcTotalPower(
  fixtures: Omit<PowerFixture, 'totalPower'>[],
  voltage = 220,
  safetyFactor = 0.8,
  powerFactor = 0.85,
): PowerCalcResult {
  const totalPowerW = fixtures.reduce((sum, f) => sum + f.quantity * f.powerW, 0)
  const totalPowerKW = totalPowerW / 1000

  // 视在功率 = 有功功率 / 功率因数
  const apparentPowerVA = totalPowerW / powerFactor
  // 电流 = 视在功率 / 电压
  const currentA = apparentPowerVA / voltage
  // 安全电流（断路器应按此选型）
  const safeCurrentA = currentA / safetyFactor
  // 推荐断路器
  const recommendedBreakerA = selectBreaker(safeCurrentA)

  // 一般断路器额定电流的 80% 为安全运行上限
  const breakerSafeCapacity = recommendedBreakerA * 0.8
  const isOverloaded = currentA > breakerSafeCapacity

  return {
    totalPowerW,
    totalPowerKW: Math.round(totalPowerKW * 100) / 100,
    currentA: Math.round(currentA * 100) / 100,
    safeCurrentA: Math.round(safeCurrentA * 100) / 100,
    recommendedBreakerA,
    isOverloaded,
    safetyFactor,
    powerFactor,
  }
}

/**
 * 多回路分析
 * @param circuits 回路列表，每个回路含多个灯具
 * @param safetyFactor 安全系数
 * @param powerFactor 功率因数
 */
export function calcMultiCircuit(
  circuits: PowerCircuit[],
  safetyFactor = 0.8,
  powerFactor = 0.85,
): PowerCalcResult {
  const byCircuit: CircuitResult[] = circuits.map(circuit => {
    const voltage = circuit.voltage ?? 220
    const result = calcTotalPower(circuit.fixtures, voltage, safetyFactor, powerFactor)
    return {
      circuitId: circuit.id,
      circuitName: circuit.name,
      totalPowerW: result.totalPowerW,
      currentA: result.currentA,
      safeCurrentA: result.safeCurrentA,
      isOverloaded: result.isOverloaded,
    }
  })

  const allFixtures = circuits.flatMap(c => c.fixtures)
  const totalResult = calcTotalPower(allFixtures, 220, safetyFactor, powerFactor)

  return { ...totalResult, byCircuit }
}

/**
 * 计算电缆截面积（平方毫米）推荐规格
 * 基于：电流、电压降要求、导线长度
 * 
 * @param currentA 电流（安培）
 * @param lengthM 导线长度（米）
 * @param voltageDrop 允许电压降百分比（默认 5%）
 * @param voltage 电压（默认 220V）
 */
export function calcCableCrossSection(
  currentA: number,
  lengthM: number,
  voltageDrop = 5,
  voltage = 220,
): { crossSectionMm2: number; spec: string; warning?: string } {
  // 铜线电阻率（Ω·mm²/m）
  const resistivity = 0.0172
  // 允许电压降（V）
  const allowedDropV = (voltage * voltageDrop) / 100
  // 需要截面积（mm²）= 2 * 电阻率 * 长度 * 电流 / 允许电压降
  const requiredMm2 = (2 * resistivity * lengthM * currentA) / allowedDropV

  // 标准截面积规格
  const standardSpecs = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120]
  const selected = standardSpecs.find(s => s >= requiredMm2) ?? 120

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

// ─── Adapter exports for PowerCalcScreen ─────────────────────────────────────

export function calculatePower(fixtures: Omit<PowerFixture, 'totalPower'>[], voltage = 220): number {
  return fixtures.reduce((sum, f) => sum + f.quantity * f.powerW, 0)
}

export function calculateCurrent(powerW: number, voltage = 220): number {
  return Math.round((powerW / voltage) * 100) / 100
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

