import client from './client'

export interface Project {
  id: string
  name: string
  venue?: string
  address?: string
  status?: string
}

export const projectsApi = {
  list: (): Promise<Project[]> => client.get('/projects'),
}
