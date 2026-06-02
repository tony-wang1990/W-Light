/**
 * LTC / SMPTE 时码换算工具。
 *
 * 当前提供离线帧率换算、起止时码计算和同步配置建议；
 * 实际 LTC 音频波形导出可在后续接入音频编码模块。
 */

export type TimecodeFrameRate = 24 | 25 | 29.97 | 30 | 50 | 60

export interface ParsedTimecode {
  hours: number
  minutes: number
  seconds: number
  frames: number
}

export interface TimecodeCalcResult {
  startTimecode: string
  endTimecode: string
  frameRate: TimecodeFrameRate
  totalFrames: number
  durationSeconds: number
  dropFrame: boolean
  warnings: string[]
}

const TIMECODE_PATTERN = /^(\d{2}):(\d{2}):(\d{2})[:;](\d{2})$/

function nominalFps(frameRate: TimecodeFrameRate) {
  return Math.round(frameRate)
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function parseTimecode(value: string, frameRate: TimecodeFrameRate): ParsedTimecode {
  const match = value.trim().match(TIMECODE_PATTERN)
  if (!match) throw new Error('时码格式应为 HH:MM:SS:FF')

  const parsed = {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: Number(match[3]),
    frames: Number(match[4]),
  }
  const fps = nominalFps(frameRate)

  if (parsed.minutes > 59 || parsed.seconds > 59 || parsed.frames >= fps) {
    throw new Error(`时码超出 ${fps}fps 范围`)
  }

  return parsed
}

export function timecodeToFrames(value: string, frameRate: TimecodeFrameRate): number {
  const parsed = parseTimecode(value, frameRate)
  const fps = nominalFps(frameRate)
  return (((parsed.hours * 60 + parsed.minutes) * 60) + parsed.seconds) * fps + parsed.frames
}

export function framesToTimecode(frames: number, frameRate: TimecodeFrameRate, dropFrame = false): string {
  const fps = nominalFps(frameRate)
  const positiveFrames = Math.max(Math.floor(frames), 0)
  const hours = Math.floor(positiveFrames / (fps * 3600))
  const minutes = Math.floor((positiveFrames % (fps * 3600)) / (fps * 60))
  const seconds = Math.floor((positiveFrames % (fps * 60)) / fps)
  const frame = positiveFrames % fps
  const separator = dropFrame ? ';' : ':'

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(frame)}`
}

export function calculateTimecodeRange(
  startTimecode: string,
  frameRate: TimecodeFrameRate,
  durationSeconds: number,
  dropFrame = frameRate === 29.97,
): TimecodeCalcResult {
  const warnings: string[] = []
  const startFrames = timecodeToFrames(startTimecode, frameRate)
  const totalFrames = Math.max(Math.round(durationSeconds * frameRate), 0)
  const endFrames = startFrames + totalFrames

  if (frameRate === 29.97 && !dropFrame) {
    warnings.push('29.97fps 通常建议使用 drop-frame 格式，避免长时间节目累积误差')
  }
  if (durationSeconds <= 0) {
    warnings.push('时长为 0，生成前请设置节目或测试时长')
  }

  return {
    startTimecode: framesToTimecode(startFrames, frameRate, dropFrame),
    endTimecode: framesToTimecode(endFrames, frameRate, dropFrame),
    frameRate,
    totalFrames,
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    dropFrame,
    warnings,
  }
}

export const TIMECODE_FRAME_RATES: TimecodeFrameRate[] = [24, 25, 29.97, 30, 50, 60]

export const LTC_ROUTING_PRESETS = [
  { name: '左声道 LTC / 右声道 Click', left: 'LTC', right: 'Click', useCase: '排练监听和控台同步' },
  { name: '左声道 LTC / 右声道 Guide', left: 'LTC', right: 'Guide', useCase: '演出音乐带旁白或提示音' },
  { name: '双声道 LTC', left: 'LTC', right: 'LTC', useCase: '冗余输出到不同设备' },
  { name: '右声道 LTC', left: 'Program', right: 'LTC', useCase: '节目音频和时码同文件输出' },
]
