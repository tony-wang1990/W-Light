/**
 * 光束角度计算工具
 *
 * 基于三角函数计算投射光束相关参数
 * 公式来源：基础几何光学，光束角 = 2 × arctan(直径/2 / 距离)
 */

export interface BeamAngleResult {
  /** 光束角度（度） */
  beamAngle: number
  /** 半角（度） */
  halfAngle: number
  /** 光斑面积（平方米） */
  spotArea: number
  /** 光斑周长（米） */
  spotCircumference: number
}

export interface SpotSizeResult {
  /** 光斑直径（米） */
  diameter: number
  /** 光斑半径（米） */
  radius: number
  /** 光斑面积（平方米） */
  area: number
}

/**
 * 已知投射距离和光斑直径，计算光束角度
 * @param distance 投射距离（米）
 * @param spotDiameter 光斑直径（米）
 */
export function calcBeamAngle(distance: number, spotDiameter: number): BeamAngleResult {
  if (distance <= 0) throw new Error('投射距离必须大于 0')
  if (spotDiameter <= 0) throw new Error('光斑直径必须大于 0')

  const halfAngleRad = Math.atan((spotDiameter / 2) / distance)
  const halfAngle = halfAngleRad * (180 / Math.PI)
  const beamAngle = halfAngle * 2

  const radius = spotDiameter / 2
  const spotArea = Math.PI * radius * radius
  const spotCircumference = 2 * Math.PI * radius

  return {
    beamAngle: Math.round(beamAngle * 100) / 100,
    halfAngle: Math.round(halfAngle * 100) / 100,
    spotArea: Math.round(spotArea * 1000) / 1000,
    spotCircumference: Math.round(spotCircumference * 1000) / 1000,
  }
}

/**
 * 已知光束角度和投射距离，计算光斑大小
 * @param distance 投射距离（米）
 * @param beamAngle 光束角度（度）
 */
export function calcSpotSize(distance: number, beamAngle: number): SpotSizeResult {
  if (distance <= 0) throw new Error('投射距离必须大于 0')
  if (beamAngle <= 0 || beamAngle >= 180) throw new Error('光束角度必须在 0°~180° 之间')

  const halfAngleRad = (beamAngle / 2) * (Math.PI / 180)
  const radius = distance * Math.tan(halfAngleRad)
  const diameter = radius * 2
  const area = Math.PI * radius * radius

  return {
    diameter: Math.round(diameter * 1000) / 1000,
    radius: Math.round(radius * 1000) / 1000,
    area: Math.round(area * 1000) / 1000,
  }
}

/**
 * 计算灯具在不同距离的光斑大小（用于生成对照表）
 * @param beamAngle 光束角度（度）
 * @param distances 距离数组（米）
 */
export function calcBeamProjectionTable(
  beamAngle: number,
  distances: number[],
): Array<{ distance: number; diameter: number; area: number }> {
  return distances.map(d => {
    const result = calcSpotSize(d, beamAngle)
    return { distance: d, diameter: result.diameter, area: result.area }
  })
}

/**
 * 常见灯具光束角参考
 */
export const BEAM_ANGLE_REFERENCES = [
  { type: '超窄光束灯（Beam）', angle: 2, description: '极锐利光柱，适合空中光效' },
  { type: '窄聚光灯（Spot）', angle: 8, description: '精准照射单个演员或物件' },
  { type: '中等聚光', angle: 15, description: '通用舞台聚光' },
  { type: '椭圆聚光（Leko）', angle: 23, description: '可遮挡成形的精准投射' },
  { type: 'Par 64 中光', angle: 36, description: '通用舞台侧光、顶光' },
  { type: '柔光灯（Fresnel）', angle: 50, description: '柔和散射，常用于顶光' },
  { type: '泛光灯（Wash）', angle: 70, description: '大面积均匀铺光' },
  { type: '天排灯', angle: 100, description: '天幕均匀染色' },
]
