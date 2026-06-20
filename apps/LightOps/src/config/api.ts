export const API_BASE_URL_STORAGE_KEY = 'api_base_url'

export const DEV_API_URL = 'http://10.0.2.2:3000/v1'
export const PROD_API_URL = 'https://w-light.199060.xyz/v1'
export const DEFAULT_API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL

export function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim()
  const baseUrl = trimmed || DEFAULT_API_BASE_URL
  const withoutTrailingSlash = baseUrl.replace(/\/+$/, '')

  return withoutTrailingSlash.endsWith('/v1') ? withoutTrailingSlash : `${withoutTrailingSlash}/v1`
}

export function isValidApiBaseUrl(value: string) {
  return /^https?:\/\/\S+$/i.test(value)
}
