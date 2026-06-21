#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageFiles = [
  'package.json',
  'apps/LightOps/package.json',
  'apps/desktop/package.json',
  'apps/web/package.json',
]

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(rootDir, relativePath), 'utf8'))
}

function writeJson(relativePath, value) {
  writeFileSync(join(rootDir, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function baseVersion() {
  return String(readJson('package.json').version || '0.0.0').replace(/-.*$/, '')
}

function releaseVersion() {
  if (process.env.W_LIGHT_RELEASE_VERSION) return process.env.W_LIGHT_RELEASE_VERSION
  const runNumber = process.env.GITHUB_RUN_NUMBER
  if (!runNumber) return readJson('package.json').version
  const attempt = process.env.GITHUB_RUN_ATTEMPT || '1'
  return `${baseVersion()}-build.${runNumber}.${attempt}`
}

function androidVersionCode() {
  if (process.env.W_LIGHT_VERSION_CODE) return process.env.W_LIGHT_VERSION_CODE
  const runNumber = Number(process.env.GITHUB_RUN_NUMBER || 0)
  if (runNumber > 0) {
    const epochMinutes = Math.floor((Date.now() - Date.UTC(2020, 0, 1)) / 60_000)
    return String(epochMinutes * 10 + (runNumber % 10))
  }
  const now = new Date()
  const year = String(now.getUTCFullYear()).slice(-2)
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  const attempt = String(process.env.GITHUB_RUN_ATTEMPT || '1').padStart(2, '0').slice(-2)
  return `${year}${month}${day}${attempt}`
}

const version = releaseVersion()
const versionCode = androidVersionCode()

for (const packageFile of packageFiles) {
  const packageJson = readJson(packageFile)
  packageJson.version = version
  writeJson(packageFile, packageJson)
}

if (process.env.GITHUB_ENV) {
  appendFileSync(
    process.env.GITHUB_ENV,
    `W_LIGHT_RELEASE_VERSION=${version}\nW_LIGHT_VERSION_CODE=${versionCode}\n`,
    'utf8',
  )
}

console.log(`Client release version: ${version}`)
console.log(`Android version code: ${versionCode}`)
