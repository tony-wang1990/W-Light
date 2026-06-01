import client from './client'
import type { User } from '../types'

export const usersApi = {
  list: (): Promise<User[]> =>
    client.get<User[] | { items: User[] }>('/users')
      .then(data => (Array.isArray(data) ? data : data.items || [])),
}
