import client from './client'
import type { User } from '../types'

export const usersApi = {
  list: (options?: { includeWorkload?: boolean; projectId?: string }): Promise<User[]> =>
    client.get<User[] | { items: User[] }>('/users', {
      params: {
        includeWorkload: options?.includeWorkload ? 'true' : undefined,
        projectId: options?.projectId,
      },
    })
      .then(data => (Array.isArray(data) ? data : data.items || [])),
}
