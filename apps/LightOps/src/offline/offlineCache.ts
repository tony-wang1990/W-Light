import { secureStorage } from '../storage/secureStorage'

interface CachedApiResponse<T> {
  cachedAt: string
  data: T
}

export interface OfflineCacheHit {
  cacheKey: string
  url: string
  cachedAt: string
  servedAt: string
}

const cachePrefix = 'api_cache_v1'
const lastCacheHitKey = `${cachePrefix}:last_hit`
const cacheablePrefixes = ['/orders', '/devices', '/parts']

function stableStringify(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value || {})
  if (Array.isArray(value)) return JSON.stringify(value.map(item => stableStringify(item)))

  const record = value as Record<string, unknown>
  return JSON.stringify(
    Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = record[key]
        return acc
      }, {}),
  )
}

export function isCacheableApiGet(url: string) {
  const path = url.split('?')[0]
  return cacheablePrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

export function getApiCacheKey(projectId: string, url: string, params?: unknown) {
  return `${cachePrefix}:${projectId}:${url}:${stableStringify(params)}`
}

export function setCachedApiResponse<T>(key: string, data: T) {
  const envelope: CachedApiResponse<T> = {
    cachedAt: new Date().toISOString(),
    data,
  }
  secureStorage.set(key, JSON.stringify(envelope))
}

export function getCachedApiResponse<T>(key: string): CachedApiResponse<T> | null {
  const raw = secureStorage.getString(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null
    return parsed as CachedApiResponse<T>
  } catch {
    secureStorage.delete(key)
    return null
  }
}

export function recordOfflineCacheHit(hit: OfflineCacheHit) {
  secureStorage.set(lastCacheHitKey, JSON.stringify(hit))
}

export function clearLastOfflineCacheHit(url?: string) {
  if (!url) {
    secureStorage.delete(lastCacheHitKey)
    return
  }

  const hit = peekLastOfflineCacheHit()
  if (hit?.url === url) secureStorage.delete(lastCacheHitKey)
}

export function peekLastOfflineCacheHit(): OfflineCacheHit | null {
  const raw = secureStorage.getString(lastCacheHitKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('url' in parsed) || !('cachedAt' in parsed)) {
      secureStorage.delete(lastCacheHitKey)
      return null
    }
    return parsed as OfflineCacheHit
  } catch {
    secureStorage.delete(lastCacheHitKey)
    return null
  }
}

export function takeLastOfflineCacheHit(url?: string): OfflineCacheHit | null {
  const hit = peekLastOfflineCacheHit()
  if (!hit) return null
  if (url && hit.url !== url) return null

  secureStorage.delete(lastCacheHitKey)
  return hit
}
