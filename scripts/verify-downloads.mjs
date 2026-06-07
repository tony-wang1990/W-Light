#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let downloadsDir = process.env.DOWNLOADS_DIR || join(rootDir, 'deploy', 'downloads')
let strict = false

function usage() {
  console.log(`Usage: scripts/verify-downloads.mjs [options]

Verifies client release artifacts in deploy/downloads:
  - *.sha256 files match their artifacts
  - w-light-*.json metadata points to existing files
  - metadata sha256 and sizeBytes match when present

Options:
  --downloads-dir DIR   Downloads directory, default deploy/downloads
  --strict              Require Android APK and Windows installer artifacts
`)
}

const args = process.argv.slice(2)
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  switch (arg) {
    case '--':
      break
    case '--downloads-dir':
      downloadsDir = resolve(args[index + 1] || '')
      index += 1
      break
    case '--strict':
      strict = true
      break
    case '-h':
    case '--help':
      usage()
      process.exit(0)
      break
    default:
      console.error(`Unknown option: ${arg}`)
      usage()
      process.exit(1)
  }
}

downloadsDir = resolve(downloadsDir)

function fail(message) {
  console.error(message)
  process.exit(1)
}

function readText(file) {
  return readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function readChecksumFile(file) {
  return readText(file).trim().split(/\s+/)[0]?.toLowerCase() || ''
}

function verifyChecksumFile(checksumFile, verifiedChecksums) {
  if (verifiedChecksums.has(checksumFile)) return

  const artifact = checksumFile.replace(/\.sha256$/i, '')
  if (!existsSync(artifact)) fail(`Missing artifact for checksum: ${artifact}`)

  const expected = readChecksumFile(checksumFile)
  const actual = sha256(artifact)
  if (expected !== actual) {
    fail(`Checksum mismatch: ${artifact}
  expected: ${expected}
  actual:   ${actual}`)
  }

  verifiedChecksums.add(checksumFile)
  console.log(`OK checksum ${artifact.split(/[\\/]/).pop()}`)
}

function verifyMetadataFile(metadataFile, verifiedChecksums) {
  const metadata = JSON.parse(readText(metadataFile))
  if (!metadata.file) fail(`Metadata missing file field: ${metadataFile}`)

  const artifact = join(downloadsDir, metadata.file)
  if (!existsSync(artifact)) fail(`Metadata points to missing artifact: ${metadata.file}`)

  if (metadata.sha256) {
    const expected = String(metadata.sha256).toLowerCase()
    const actual = sha256(artifact)
    if (expected !== actual) {
      fail(`Metadata sha256 mismatch: ${metadata.file}
  expected: ${expected}
  actual:   ${actual}`)
    }
  }

  if (metadata.sizeBytes !== undefined) {
    const expected = String(metadata.sizeBytes)
    const actual = String(statSync(artifact).size)
    if (expected !== actual) {
      fail(`Metadata sizeBytes mismatch: ${metadata.file}
  expected: ${expected}
  actual:   ${actual}`)
    }
  }

  const checksumFile = `${artifact}.sha256`
  if (existsSync(checksumFile)) verifyChecksumFile(checksumFile, verifiedChecksums)

  console.log(`OK metadata ${metadataFile.split(/[\\/]/).pop()} -> ${metadata.file}`)
}

function requireArtifact(name) {
  if (!existsSync(join(downloadsDir, name))) fail(`Required artifact missing: ${name}`)
}

if (!existsSync(downloadsDir)) fail(`Downloads directory does not exist: ${downloadsDir}`)

const entries = await readdir(downloadsDir)
const metadataFiles = entries
  .filter((name) => /^w-light-.*\.json$/i.test(name))
  .map((name) => join(downloadsDir, name))
const checksumFiles = entries
  .filter((name) => /\.sha256$/i.test(name))
  .map((name) => join(downloadsDir, name))
const verifiedChecksums = new Set()

if (strict) {
  requireArtifact('w-light-latest.apk')
  requireArtifact('w-light-latest.apk.sha256')
  requireArtifact('W-Light-Setup-latest.exe')
  requireArtifact('W-Light-Setup-latest.exe.sha256')
}

if (metadataFiles.length === 0 && checksumFiles.length === 0) {
  console.log(`No release metadata or checksum files found in ${downloadsDir}.`)
  console.log('Build and publish clients first, then rerun this verifier.')
  process.exit(0)
}

for (const metadataFile of metadataFiles) verifyMetadataFile(metadataFile, verifiedChecksums)
for (const checksumFile of checksumFiles) verifyChecksumFile(checksumFile, verifiedChecksums)

console.log(`Client downloads verified: ${downloadsDir}`)
