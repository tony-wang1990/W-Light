import { describe, expect, it } from 'vitest'
import {
  WEB_API_BASE_URL_STORAGE_KEY,
  getApiBaseUrl,
  getAuthRequestHeaders,
  normalizeApiBaseUrl,
  setApiBaseUrl,
} from './client'
import { useAuthStore } from '../store/authStore'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222'

describe('web api client helpers', () => {
  it('normalizes API base URL to the /v1 backend path', () => {
    expect(normalizeApiBaseUrl('')).toBe('/v1')
    expect(normalizeApiBaseUrl('/v1')).toBe('/v1')
    expect(normalizeApiBaseUrl('http://example.com')).toBe('http://example.com/v1')
    expect(normalizeApiBaseUrl('http://example.com/v1/')).toBe('http://example.com/v1')
  })

  it('persists custom API base URL and removes same-origin default', () => {
    expect(setApiBaseUrl('http://server:3005')).toBe('http://server:3005/v1')
    expect(localStorage.getItem(WEB_API_BASE_URL_STORAGE_KEY)).toBe('http://server:3005/v1')
    expect(getApiBaseUrl()).toBe('http://server:3005/v1')

    expect(setApiBaseUrl('/v1')).toBe('/v1')
    expect(localStorage.getItem(WEB_API_BASE_URL_STORAGE_KEY)).toBeNull()
  })

  it('builds authorization and project headers from the current auth store', () => {
    useAuthStore.getState().setAuth('token-1', {
      id: 'user-1',
      role: 'engineer',
      projectIds: [PROJECT_ID],
    })

    expect(getAuthRequestHeaders()).toEqual({
      Authorization: 'Bearer token-1',
      'X-Project-Id': PROJECT_ID,
    })
  })

  it('does not send a project header for invalid or unauthorized project ids', () => {
    useAuthStore.getState().setAuth('token-2', {
      id: 'user-2',
      role: 'engineer',
      projectIds: [PROJECT_ID],
    })
    useAuthStore.getState().setCurrentProject(OTHER_PROJECT_ID)

    expect(getAuthRequestHeaders()).toEqual({
      Authorization: 'Bearer token-2',
      'X-Project-Id': PROJECT_ID,
    })
  })
})
