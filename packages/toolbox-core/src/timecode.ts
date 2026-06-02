/**
 * LTC / SMPTE 时码换算与音频生成工具。
 *
 * 生成逻辑覆盖 80-bit LTC frame word、sync word、BMC 编码和 16-bit PCM WAV。
 * 正式演出前仍建议用控台或独立时码读取器校验帧率、起始时码和声道路由。
 */

export type TimecodeFrameRate = 24 | 25 | 29.97 | 30 | 50 | 60
export type LtcAudioChannel = 'LTC' | 'Click' | 'Guide' | 'Program' | 'Silence' | string

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

export interface LtcWavOptions {
  startTimecode: string
  frameRate: TimecodeFrameRate
  durationSeconds: number
  dropFrame?: boolean
  sampleRate?: 44100 | 48000
  leftChannel?: LtcAudioChannel
  rightChannel?: LtcAudioChannel
  level?: number
}

export interface LtcWavResult {
  fileName: string
  mimeType: 'audio/wav'
  sampleRate: number
  channels: 2
  bitsPerSample: 16
  durationSeconds: number
  totalFrames: number
  byteLength: number
  base64: string
  dataUri: string
  warnings: string[]
}

const TIMECODE_PATTERN = /^(\d{2}):(\d{2}):(\d{2})[:;](\d{2})$/
const LTC_SYNC_WORD = '0011111111111101'
const MAX_LTC_WAV_DURATION_SECONDS = 120
const DEFAULT_SAMPLE_RATE = 48000
const DEFAULT_LTC_LEVEL = 0.72
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function nominalFps(frameRate: TimecodeFrameRate) {
  return Math.round(frameRate)
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function setBcdBits(bits: number[], start: number, width: number, value: number) {
  for (let index = 0; index < width; index += 1) {
    bits[start + index] = (value >> index) & 1
  }
}

function isDropFrameRate(frameRate: TimecodeFrameRate) {
  return frameRate === 29.97
}

function dropFramesPerMinute(frameRate: TimecodeFrameRate) {
  return isDropFrameRate(frameRate) ? 2 : 0
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

  if (parsed.hours > 23 || parsed.minutes > 59 || parsed.seconds > 59 || parsed.frames >= fps) {
    throw new Error(`时码超出 ${fps}fps 范围`)
  }

  return parsed
}

export function timecodeToFrames(
  value: string,
  frameRate: TimecodeFrameRate,
  dropFrame = false,
): number {
  const parsed = parseTimecode(value, frameRate)
  const fps = nominalFps(frameRate)
  const absoluteFrames = (((parsed.hours * 60 + parsed.minutes) * 60) + parsed.seconds) * fps + parsed.frames

  if (!dropFrame || !isDropFrameRate(frameRate)) return absoluteFrames

  const totalMinutes = parsed.hours * 60 + parsed.minutes
  return absoluteFrames - dropFramesPerMinute(frameRate) * (totalMinutes - Math.floor(totalMinutes / 10))
}

export function framesToTimecode(
  frames: number,
  frameRate: TimecodeFrameRate,
  dropFrame = false,
): string {
  const fps = nominalFps(frameRate)
  let positiveFrames = Math.max(Math.floor(frames), 0)

  if (dropFrame && isDropFrameRate(frameRate)) {
    const dropFrames = dropFramesPerMinute(frameRate)
    const framesPer10Minutes = fps * 60 * 10 - dropFrames * 9
    const framesPer24Hours = (fps * 3600 - dropFrames * 54) * 24

    positiveFrames %= framesPer24Hours
    const tenMinuteBlocks = Math.floor(positiveFrames / framesPer10Minutes)
    const remainingFrames = positiveFrames % framesPer10Minutes
    const droppedFrames = dropFrames * 9 * tenMinuteBlocks
      + dropFrames * Math.floor(Math.max(remainingFrames - dropFrames, 0) / (fps * 60 - dropFrames))

    positiveFrames += droppedFrames
  }

  const hours = Math.floor(positiveFrames / (fps * 3600)) % 24
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
  const startFrames = timecodeToFrames(startTimecode, frameRate, dropFrame)
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

export function buildLtcFrameBits(
  timecode: string,
  frameRate: TimecodeFrameRate,
  dropFrame = false,
): number[] {
  const parsed = parseTimecode(timecode, frameRate)
  const bits = Array(80).fill(0)
  const frameUnits = parsed.frames % 10
  const frameTens = Math.floor(parsed.frames / 10)
  const secondsUnits = parsed.seconds % 10
  const secondsTens = Math.floor(parsed.seconds / 10)
  const minutesUnits = parsed.minutes % 10
  const minutesTens = Math.floor(parsed.minutes / 10)
  const hoursUnits = parsed.hours % 10
  const hoursTens = Math.floor(parsed.hours / 10)

  setBcdBits(bits, 0, 4, frameUnits)
  setBcdBits(bits, 8, 2, frameTens)
  bits[10] = dropFrame && isDropFrameRate(frameRate) ? 1 : 0
  bits[11] = 0
  setBcdBits(bits, 16, 4, secondsUnits)
  setBcdBits(bits, 24, 3, secondsTens)
  setBcdBits(bits, 32, 4, minutesUnits)
  setBcdBits(bits, 40, 3, minutesTens)
  setBcdBits(bits, 48, 4, hoursUnits)
  setBcdBits(bits, 56, 2, hoursTens)
  bits[58] = 0

  for (let index = 0; index < LTC_SYNC_WORD.length; index += 1) {
    bits[64 + index] = Number(LTC_SYNC_WORD[index])
  }

  const correctionBit = frameRate === 25 ? 59 : 27
  bits[correctionBit] = 0
  const zeroCount = bits.filter(bit => bit === 0).length
  if (zeroCount % 2 === 1) bits[correctionBit] = 1

  return bits
}

function fillSamples(samples: Float32Array, start: number, end: number, value: number) {
  const safeStart = clamp(start, 0, samples.length)
  const safeEnd = clamp(end, 0, samples.length)
  for (let index = safeStart; index < safeEnd; index += 1) {
    samples[index] = value
  }
}

function generateLtcSignal(options: Required<Pick<LtcWavOptions, 'startTimecode' | 'frameRate' | 'durationSeconds' | 'dropFrame' | 'sampleRate' | 'level'>>) {
  const totalFrames = Math.max(Math.round(options.durationSeconds * options.frameRate), 1)
  const totalSamples = Math.ceil(options.durationSeconds * options.sampleRate)
  const samples = new Float32Array(totalSamples)
  const startFrames = timecodeToFrames(options.startTimecode, options.frameRate, options.dropFrame)
  const samplesPerBit = options.sampleRate / (options.frameRate * 80)
  let level = -options.level
  let bitCursor = 0

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const timecode = framesToTimecode(startFrames + frameIndex, options.frameRate, options.dropFrame)
    const bits = buildLtcFrameBits(timecode, options.frameRate, options.dropFrame)

    bits.forEach(bit => {
      const bitStart = Math.round(bitCursor * samplesPerBit)
      const bitEnd = Math.round((bitCursor + 1) * samplesPerBit)
      const bitMid = Math.round((bitStart + bitEnd) / 2)

      level *= -1
      if (bit === 1) {
        fillSamples(samples, bitStart, bitMid, level)
        level *= -1
        fillSamples(samples, bitMid, bitEnd, level)
      } else {
        fillSamples(samples, bitStart, bitEnd, level)
      }

      bitCursor += 1
    })
  }

  return { samples, totalFrames }
}

function generateClickSample(sampleIndex: number, sampleRate: number) {
  const secondPosition = sampleIndex % sampleRate
  const clickLength = Math.floor(sampleRate * 0.035)
  if (secondPosition > clickLength) return 0

  const second = Math.floor(sampleIndex / sampleRate)
  const frequency = second % 4 === 0 ? 1600 : 1000
  const envelope = 1 - secondPosition / clickLength
  return Math.sin((2 * Math.PI * frequency * secondPosition) / sampleRate) * envelope * 0.34
}

function channelSample(channel: LtcAudioChannel, ltcSample: number, sampleIndex: number, sampleRate: number) {
  if (channel === 'LTC') return ltcSample
  if (channel === 'Click') return generateClickSample(sampleIndex, sampleRate)
  return 0
}

function writeString(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index)
  }
}

function writeUint16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >> 8) & 0xff
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >> 8) & 0xff
  bytes[offset + 2] = (value >> 16) & 0xff
  bytes[offset + 3] = (value >> 24) & 0xff
}

function bytesToBase64(bytes: Uint8Array) {
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index]
    const byte2 = index + 1 < bytes.length ? bytes[index + 1] : 0
    const byte3 = index + 2 < bytes.length ? bytes[index + 2] : 0
    const triplet = (byte1 << 16) | (byte2 << 8) | byte3

    output += BASE64_ALPHABET[(triplet >> 18) & 63]
    output += BASE64_ALPHABET[(triplet >> 12) & 63]
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 63] : '='
    output += index + 2 < bytes.length ? BASE64_ALPHABET[triplet & 63] : '='
  }

  return output
}

export function generateLtcWav(options: LtcWavOptions): LtcWavResult {
  const durationSeconds = Math.min(Math.max(options.durationSeconds, 0), MAX_LTC_WAV_DURATION_SECONDS)
  if (durationSeconds <= 0) throw new Error('导出时长必须大于 0 秒')

  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE
  const dropFrame = options.dropFrame ?? options.frameRate === 29.97
  const level = clamp(options.level ?? DEFAULT_LTC_LEVEL, 0.1, 0.95)
  const leftChannel = options.leftChannel ?? 'LTC'
  const rightChannel = options.rightChannel ?? 'Click'
  const warnings: string[] = []

  if (options.durationSeconds > MAX_LTC_WAV_DURATION_SECONDS) {
    warnings.push(`移动端单次导出已限制为 ${MAX_LTC_WAV_DURATION_SECONDS}s，超出部分请分段生成`)
  }
  if (options.frameRate === 29.97 && !dropFrame) {
    warnings.push('29.97fps 非 drop-frame LTC 可能在长节目中累积时码误差')
  }
  if (leftChannel !== 'LTC' && rightChannel !== 'LTC') {
    warnings.push('当前路由未包含 LTC 声道，已生成静音/辅助声道，请至少保留一侧为 LTC')
  }

  const { samples, totalFrames } = generateLtcSignal({
    startTimecode: options.startTimecode,
    frameRate: options.frameRate,
    durationSeconds,
    dropFrame,
    sampleRate,
    level,
  })
  const channels = 2
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataSize = samples.length * channels * bytesPerSample
  const bytes = new Uint8Array(44 + dataSize)
  const byteRate = sampleRate * channels * bytesPerSample
  const blockAlign = channels * bytesPerSample

  writeString(bytes, 0, 'RIFF')
  writeUint32(bytes, 4, 36 + dataSize)
  writeString(bytes, 8, 'WAVE')
  writeString(bytes, 12, 'fmt ')
  writeUint32(bytes, 16, 16)
  writeUint16(bytes, 20, 1)
  writeUint16(bytes, 22, channels)
  writeUint32(bytes, 24, sampleRate)
  writeUint32(bytes, 28, byteRate)
  writeUint16(bytes, 32, blockAlign)
  writeUint16(bytes, 34, bitsPerSample)
  writeString(bytes, 36, 'data')
  writeUint32(bytes, 40, dataSize)

  let offset = 44
  for (let index = 0; index < samples.length; index += 1) {
    const left = channelSample(leftChannel, samples[index], index, sampleRate)
    const right = channelSample(rightChannel, samples[index], index, sampleRate)
    const leftInt = Math.round(clamp(left, -1, 1) * 32767)
    const rightInt = Math.round(clamp(right, -1, 1) * 32767)

    writeUint16(bytes, offset, leftInt < 0 ? 0x10000 + leftInt : leftInt)
    writeUint16(bytes, offset + 2, rightInt < 0 ? 0x10000 + rightInt : rightInt)
    offset += 4
  }

  const safeStart = options.startTimecode.replace(/[:;]/g, '-')
  const base64 = bytesToBase64(bytes)

  return {
    fileName: `lightops-ltc-${safeStart}-${options.frameRate}fps.wav`,
    mimeType: 'audio/wav',
    sampleRate,
    channels,
    bitsPerSample,
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    totalFrames,
    byteLength: bytes.length,
    base64,
    dataUri: `data:audio/wav;base64,${base64}`,
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
