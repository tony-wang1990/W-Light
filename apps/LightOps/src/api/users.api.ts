import client from './client'
import type { User } from '../types'

export const usersApi = {
  list: (options?: { includeWorkload?: boolean; projectId?: string; role?: User['role'] }): Promise<User[]> =>
    client.get<User[] | { items: User[] }>('/users', {
      params: {
        includeWorkload: options?.includeWorkload ? 'true' : undefined,
        projectId: options?.projectId,
        role: options?.role,
      },
    })
      .then(data => (Array.isArray(data) ? data : data.items || [])),
}
