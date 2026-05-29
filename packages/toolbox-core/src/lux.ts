/**
 * 环境照度计算工具
 *
 * 基于光度学余弦定律和平方反比定律
 * 适用于文旅项目灯光设计的照度计算
 */

export interface LuxCalcInput {
  /** 光源光强（坎德拉 cd）*/
  luminousIntensityCd: number
  /** 投射距离（米）*/
  distanceM: number
  /** 入射角（度）：光线与被照面法线的夹角 */
  incidentAngleDeg: number
}

export interface LuxCalcResult {
  /** 照度（勒克斯 lux）*/
  illuminanceLux: number
  /** 维持照度（考虑维护系数后）*/
  maintainedLux: number
  /** 光通量（流明 lm，估算）*/
  luminousFluxLm: number
}

/**
 * 使用余弦定律计算点照度
 * 公式：E = I × cos(θ) / d²
 *
 * @param input 计算输入参数
 * @param maintenanceFactor 维护系数（默认 0.8，考虑灯具老化、污染等）
 */
export function calcIlluminance(input: LuxCalcInput, maintenanceFactor = 0.8): LuxCalcResult {
  const { luminousIntensityCd, distanceM, incidentAngleDeg } = input

  if (distanceM <= 0) throw new Error('投射距离必须大于 0')
  if (luminousIntensityCd <= 0) throw new Error('光强必须大于 0')

  const incidentAngleRad = incidentAngleDeg * (Math.PI / 180)
  const cosAngle = Math.cos(incidentAngleRad)

  // 余弦定律：E = I × cos(θ) / d²
  const illuminanceLux = (luminousIntensityCd * cosAngle) / (distanceM * distanceM)
  const maintainedLux = illuminanceLux * maintenanceFactor

  // 估算光通量（对于点光源，球面上的平均光通量）
  const luminousFluxLm = luminousIntensityCd * 4 * Math.PI

  return {
    illuminanceLux: Math.round(illuminanceLux * 10) / 10,
    maintainedLux: Math.round(maintainedLux * 10) / 10,
    luminousFluxLm: Math.round(luminousFluxLm),
  }
}

/**
 * 计算需要多少光强才能达到目标照度
 * @param targetLux 目标照度（lux）
 * @param distanceM 投射距离（米）
 * @param incidentAngleDeg 入射角（度）
 * @param maintenanceFactor 维护系数
 */
export function calcRequiredIntensity(
  targetLux: number,
  distanceM: number,
  incidentAngleDeg = 0,
  maintenanceFactor = 0.8,
): number {
  const incidentAngleRad = incidentAngleDeg * (Math.PI / 180)
  const cosAngle = Math.cos(incidentAngleRad)
  // I = E × d² / (cos(θ) × maintenanceFactor)
  const intensity = (targetLux * distanceM * distanceM) / (cosAngle * maintenanceFactor)
  return Math.round(intensity)
}

/**
 * 计算多个距离点的照度对照表
 */
export function calcIlluminanceTable(
  luminousIntensityCd: number,
  distances: number[],
  incidentAngleDeg = 0,
): Array<{ distanceM: number; illuminanceLux: number }> {
  return distances.map(d => ({
    distanceM: d,
    illuminanceLux: calcIlluminance(
      { luminousIntensityCd, distanceM: d, incidentAngleDeg },
    ).illuminanceLux,
  }))
}

/**
 * 照度标准参考（lux）
 */
export const ILLUMINANCE_STANDARDS = [
  { scene: '演出舞台主区', minLux: 800, recommendLux: 1500, note: 'CIE 推荐舞台照度' },
  { scene: '演出舞台背景', minLux: 100, recommendLux: 300, note: '配合主区形成对比' },
  { scene: '文旅景观亮化', minLux: 20, recommendLux: 100, note: '户外夜景照明' },
  { scene: '展陈空间重点照明', minLux: 300, recommendLux: 500, note: '展品照明' },
  { scene: '走廊/过道', minLux: 50, recommendLux: 100, note: '安全引导照明' },
  { scene: '控制室/调音台区', minLux: 100, recommendLux: 200, note: '工作区照明' },
  { scene: '化妆间', minLux: 500, recommendLux: 750, note: '垂直面照度' },
  { scene: '观众席', minLux: 100, recommendLux: 200, note: '演出前/中场' },
]

/**
 * 常见灯具光强参考（cd）
 */
export const FIXTURE_INTENSITY_REFERENCES = [
  { name: '200W Moving Head Spot', intensityCd: 45000 },
  { name: '330W Moving Head Spot', intensityCd: 90000 },
  { name: '200W Wash Moving Head', intensityCd: 12000 },
  { name: '150W LED Fresnel', intensityCd: 18000 },
  { name: '100W LED Par', intensityCd: 8000 },
  { name: '1200W Follow Spot', intensityCd: 250000 },
  { name: '36W LED Strip (per meter)', intensityCd: 500 },
]

// ─── Adapter exports for LuxScreen ──────────────────────────────────────────

export function calculateLux(lumens: number, distanceM: number, beamAngleDeg = 30): number {
  if (distanceM <= 0 || lumens <= 0) return 0
  const halfAngleRad = (beamAngleDeg / 2) * Math.PI / 180
  const spotRadius = distanceM * Math.tan(halfAngleRad)
  const area = Math.PI * spotRadius * spotRadius
  return area > 0 ? Math.round(lumens / area) : 0
}

export const LUX_REFERENCES = [
  { scene: '演出舞台主区', min: 800, max: 1500 },
  { scene: '演出舞台背景', min: 100, max: 300 },
  { scene: '文旅景观亮化', min: 20, max: 100 },
  { scene: '展陈重点照明', min: 300, max: 500 },
  { scene: '走廊/通道', min: 50, max: 100 },
  { scene: '控制室工作区', min: 100, max: 200 },
  { scene: '化妆间', min: 500, max: 750 },
  { scene: '观众席', min: 100, max: 200 },
  { scene: '舞台追光强度', min: 3000, max: 8000 },
]

