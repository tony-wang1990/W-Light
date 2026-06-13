#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = {
  android: {
    latestName: 'w-light-latest.apk',
    metadataName: 'w-light-android.json',
    metadataBase: { platform: 'android' },
  },
  win: {
    latestName: 'W-Light-Setup-latest.exe',
    metadataName: 'w-light-desktop.json',
    metadataBase: { target: 'win' },
  },
  mac: {
    latestName: 'W-Light-latest.dmg',
    metadataName: 'w-light-desktop.json',
    metadataBase: { target: 'mac' },
  },
  linux: {
    latestName: 'W-Light-latest.AppImage',
    metadataName: 'w-light-desktop.json',
    metadataBase: { target: 'linux' },
  },
}

let target = ''
let artifactFile = ''
let downloadsDir = join(rootDir, 'deploy', 'downloads')
let version = ''

function usage() {
  console.log(`Usage: node scripts/publish-client-artifact.mjs --target TARGET --file FILE [options]

Publishes a built client artifact into deploy/downloads and writes:
  - latest artifact filename used by the download center
  - .sha256 checksum
  - w-light-android.json or w-light-desktop.json metadata

Targets:
  android, win, mac, linux

Options:
  --downloads-dir DIR   Output directory, default deploy/downloads
  --version VERSION     Version string, default root package.json version
`)
}

const args = process.argv.slice(2)
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  switch (arg) {
    case '--':
      break
    case '--target':
      target = args[index + 1] || ''
      index += 1
      break
    case '--file':
      artifactFile = resolve(args[index + 1] || '')
      index += 1
      break
    case '--downloads-dir':
      downloadsDir = resolve(args[index + 1] || '')
      index += 1
      break
    case '--version':
      version = args[index + 1] || ''
      index += 1
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

function fail(message) {
  console.error(message)
  process.exit(1)
}

function rootVersion() {
  try {
    return JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')).version || 'unknown'
  } catch {
    return 'unknown'
  }
}

function gitCommit() {
  try {
    return execFileSync('git', ['-C', rootDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

const targetConfig = targets[target]
if (!targetConfig) fail(`Unsupported target: ${target || '(missing)'}`)
if (!artifactFile) fail('Missing --file')
if (!existsSync(artifactFile)) fail(`Artifact not found: ${artifactFile}`)

mkdirSync(downloadsDir, { recursive: true })

const latestPath = join(downloadsDir, targetConfig.latestName)
copyFileSync(artifactFile, latestPath)

const hash = sha256(latestPath)
const sizeBytes = statSync(latestPath).size
writeFileSync(`${latestPath}.sha256`, `${hash}  ${targetConfig.latestName}\n`, 'utf8')

const metadata = {
  ...targetConfig.metadataBase,
  file: targetConfig.latestName,
  version: version || rootVersion(),
  sourceArtifact: basename(artifactFile),
  builtAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  commit: gitCommit(),
  sha256: hash,
  sizeBytes,
}

const metadataPath = join(downloadsDir, targetConfig.metadataName)
writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')

console.log(`Published ${target} artifact: ${latestPath}`)
console.log(`Metadata: ${metadataPath}`)
