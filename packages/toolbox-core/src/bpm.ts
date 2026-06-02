/**
 * BPM (Beats Per Minute) 检测工具
 * 
 * 使用手动打拍方式检测音乐节奏 BPM
 * 算法：记录最近 N 次打拍时间戳，计算相邻间隔均值，转换为 BPM
 */

export interface BpmResult {
  bpm: number
  avgIntervalMs: number
  tapCount: number
  minBpm: number
  maxBpm: number
  halfBpm: number
  doubleBpm: number
  stdDevMs: number
  stabilityPercent: number
  subdivisions: {
    beatMs: number
    halfBeatMs: number
    quarterBeatMs: number
    bar4Ms: number
  }
}

/** 最多保留的打拍记录数 */
const MAX_TAPS = 8

/**
 * 根据打拍时间戳数组计算 BPM
 * @param timestamps 按时间顺序的打拍时间戳数组（毫秒）
 * @returns BPM 计算结果
 */
export function calculateBpm(timestamps: number[]): BpmResult | null {
  if (timestamps.length < 2) return null

  // 取最近 MAX_TAPS 个时间戳
  const recent = timestamps.slice(-MAX_TAPS)
  
  // 计算相邻间隔
  const intervals: number[] = []
  for (let i = 1; i < recent.length; i++) {
    intervals.push(recent[i] - recent[i - 1])
  }

  if (intervals.length === 0) return null

  const avgIntervalMs = intervals.reduce((sum, v) => sum + v, 0) / intervals.length
  const bpm = 60000 / avgIntervalMs

  const bpmValues = intervals.map(interval => 60000 / interval)
  const minBpm = Math.min(...bpmValues)
  const maxBpm = Math.max(...bpmValues)
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgIntervalMs, 2), 0) / intervals.length
  const stdDevMs = Math.sqrt(variance)
  const stabilityPercent = Math.max(0, 100 - (stdDevMs / avgIntervalMs) * 100)
  const roundedBpm = Math.round(bpm * 10) / 10
  const beatMs = Math.round(avgIntervalMs)

  return {
    bpm: roundedBpm,
    avgIntervalMs: beatMs,
    tapCount: timestamps.length,
    minBpm: Math.round(minBpm * 10) / 10,
    maxBpm: Math.round(maxBpm * 10) / 10,
    halfBpm: Math.round((roundedBpm / 2) * 10) / 10,
    doubleBpm: Math.round((roundedBpm * 2) * 10) / 10,
    stdDevMs: Math.round(stdDevMs),
    stabilityPercent: Math.round(stabilityPercent),
    subdivisions: {
      beatMs,
      halfBeatMs: Math.round(beatMs / 2),
      quarterBeatMs: Math.round(beatMs / 4),
      bar4Ms: beatMs * 4,
    },
  }
}

/**
 * 检测是否节奏稳定（间隔标准差 / 平均值 < 阈值）
 * @param timestamps 打拍时间戳数组
 * @param threshold 稳定性阈值（默认 0.15 = 15%）
 */
export function isRhythmStable(timestamps: number[], threshold = 0.15): boolean {
  if (timestamps.length < 4) return false

  const recent = timestamps.slice(-MAX_TAPS)
  const intervals: number[] = []
  for (let i = 1; i < recent.length; i++) {
    intervals.push(recent[i] - recent[i - 1])
  }

  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length
  const variance = intervals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / intervals.length
  const stdDev = Math.sqrt(variance)
  return stdDev / avg < threshold
}

/**
 * 将 BPM 转换为毫秒间隔
 */
export function bpmToMs(bpm: number): number {
  return Math.round(60000 / bpm)
}

/**
 * 常见音乐节奏 BPM 范围参考
 */
export const BPM_REFERENCES = [
  { name: 'Largo（宽广）', min: 40, max: 60 },
  { name: 'Andante（行板）', min: 66, max: 76 },
  { name: 'Moderato（中板）', min: 86, max: 97 },
  { name: 'Allegro（快板）', min: 120, max: 156 },
  { name: 'Presto（急板）', min: 168, max: 200 },
  { name: 'EDM House', min: 120, max: 130 },
  { name: 'EDM Techno', min: 130, max: 150 },
  { name: 'Pop（流行）', min: 100, max: 130 },
  { name: 'Hip-Hop', min: 80, max: 100 },
]
