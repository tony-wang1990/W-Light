import assert from 'node:assert/strict'
import {
  buildLtcFrameBits,
  calculateDmxAddresses,
  calcTotalPower,
  framesToTimecode,
  generateLtcWav,
  timecodeToFrames,
} from '../src'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

test('dmx expands fixture quantities and usage', () => {
  const result = calculateDmxAddresses([
    { id: 'beam', name: 'Beam', channels: 16, quantity: 4 },
  ])

  assert.equal(result.totalChannels, 64)
  assert.equal(result.assignments.length, 4)
  assert.equal(result.assignments[3].startAddress, 49)
  assert.equal(result.universeUsage[0].usedChannels, 64)
  assert.equal(result.hasConflicts, false)
})

test('dmx detects overlapping manual addresses', () => {
  const result = calculateDmxAddresses([
    { id: 'a', name: 'A', channels: 16, quantity: 1, startAddress: 1 },
    { id: 'b', name: 'B', channels: 8, quantity: 1, startAddress: 8 },
  ])

  assert.equal(result.hasConflicts, true)
  assert.equal(result.conflicts[0].addressStart, 8)
  assert.equal(result.conflicts[0].addressEnd, 15)
})

test('power calculates current with safety factor', () => {
  const result = calcTotalPower([
    { id: 'wash', name: 'Wash', quantity: 4, powerW: 200 },
  ])

  assert.equal(result.totalPowerW, 800)
  assert.equal(result.currentA, 4.28)
  assert.equal(result.safeCurrentA, 5.35)
  assert.equal(result.recommendedBreakerA, 6)
})

test('drop-frame timecode round trips stable labels', () => {
  const labels = ['01:00:00;00', '01:00:59;28', '01:01:00;02', '01:10:00;00']

  labels.forEach(label => {
    const frames = timecodeToFrames(label, 29.97, true)
    assert.equal(framesToTimecode(frames, 29.97, true), label)
  })
})

test('ltc frame bits include sync word', () => {
  const bits = buildLtcFrameBits('01:00:00:00', 25, false)

  assert.equal(bits.length, 80)
  assert.equal(bits.slice(64).join(''), '0011111111111101')
})

test('ltc wav generation returns stereo pcm data uri', () => {
  const wav = generateLtcWav({
    startTimecode: '01:00:00:00',
    frameRate: 25,
    durationSeconds: 1,
    leftChannel: 'LTC',
    rightChannel: 'Click',
  })

  assert.equal(wav.mimeType, 'audio/wav')
  assert.equal(wav.totalFrames, 25)
  assert.equal(wav.byteLength, 192044)
  assert.ok(wav.dataUri.startsWith('data:audio/wav;base64,UklGR'))
})
