import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Clients from './Clients'

vi.mock('../../api/client', () => ({
  getApiBaseUrl: () => '/v1',
  getServerOrigin: () => 'https://w-light.example',
}))

describe('client download center', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/w-light-android.json')) {
        return {
          ok: true,
          json: async () => ({
            file: 'w-light-latest.apk',
            version: '0.9.0-build.1234.2',
            commit: 'abc1234',
            publishedAt: '2026-06-21T02:14:20Z',
            sizeBytes: 123456,
            sha256: 'a'.repeat(64),
          }),
        } as Response
      }
      if (url.endsWith('/w-light-desktop.json')) {
        return {
          ok: true,
          json: async () => ({
            file: 'W-Light-Setup-latest.exe',
            version: '0.9.0-build.1234.2',
            commit: 'abc1234',
            publishedAt: '2026-06-21T02:14:20Z',
            sizeBytes: 654321,
            sha256: 'b'.repeat(64),
          }),
        } as Response
      }
      if (init?.method === 'HEAD') return { ok: true, status: 200 } as Response
      throw new Error(`Unexpected fetch: ${url}`)
    }))
  })

  it('shows the generated release version for Android and Windows', async () => {
    render(<Clients />)

    await waitFor(() => {
      expect(screen.getAllByText('版本：0.9.0-build.1234.2')).toHaveLength(2)
    })
    expect(screen.getAllByText('包内代码：abc1234')).toHaveLength(2)
    expect(screen.getAllByText('可下载')).toHaveLength(3)
  })

  it('rechecks package metadata when the user clicks refresh', async () => {
    const user = userEvent.setup()
    render(<Clients />)
    await waitFor(() => expect(screen.getAllByText('版本：0.9.0-build.1234.2')).toHaveLength(2))

    const fetchMock = vi.mocked(fetch)
    const callsBefore = fetchMock.mock.calls.length
    await user.click(screen.getByRole('button', { name: /重新检查/ }))

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})
