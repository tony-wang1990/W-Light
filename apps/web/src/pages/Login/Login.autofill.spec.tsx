import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../store/authStore'
import Login from './Login'

const { apiPostMock, setApiBaseUrlMock } = vi.hoisted(() => ({
  apiPostMock: vi.fn(),
  setApiBaseUrlMock: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  getApiBaseUrl: () => '/v1',
  setApiBaseUrl: setApiBaseUrlMock,
  apiClient: {
    post: apiPostMock,
  },
}))

function setAutofilledValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!setter) throw new Error('HTMLInputElement value setter is unavailable')
  setter.call(input, value)
}

describe('login browser autofill', () => {
  beforeEach(() => {
    apiPostMock.mockReset()
    setApiBaseUrlMock.mockReset()
    useAuthStore.setState({ token: null, user: null, currentProjectId: null })
  })

  it('submits autofilled credentials without requiring an input event first', async () => {
    apiPostMock.mockResolvedValue({
      accessToken: 'token',
      user: {
        id: 'admin-1',
        name: 'System Admin',
        role: 'admin',
        projectIds: ['11111111-1111-4111-8111-111111111111'],
      },
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const phoneInput = screen.getByLabelText('账号') as HTMLInputElement
    const passwordInput = screen.getByLabelText('密码') as HTMLInputElement
    const submitButton = screen.getByRole('button', { name: '登录控制台' })

    setAutofilledValue(phoneInput, 'wang')
    setAutofilledValue(passwordInput, 'secret-password')

    expect(submitButton).toBeEnabled()
    fireEvent.submit(submitButton.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/auth/login', {
        phone: 'wang',
        password: 'secret-password',
      })
    })
    expect(setApiBaseUrlMock).toHaveBeenCalledWith('/v1')
  })
})
