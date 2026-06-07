import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  name?: string;
  phone?: string;
  role?: string;
  projectIds?: string[];
  [key: string]: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidProjectId(projectId?: string | null) {
  return typeof projectId === 'string' && UUID_PATTERN.test(projectId);
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  currentProjectId: string | null;
  setAuth: (token: string, user: AuthUser) => void;
  setCurrentProject: (projectId: string) => void;
  logout: () => void;
}

export function getCurrentProjectId(user?: AuthUser | null, currentProjectId?: string | null) {
  const projectIds = user?.projectIds || [];
  const isAdmin = user?.role === 'admin';

  if (currentProjectId && isValidProjectId(currentProjectId) && (isAdmin || projectIds.includes(currentProjectId))) {
    return currentProjectId;
  }

  return projectIds.find(isValidProjectId) || null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      currentProjectId: null,
      setAuth: (token, user) => set((state) => ({
        token,
        user,
        currentProjectId: getCurrentProjectId(user, state.currentProjectId),
      })),
      setCurrentProject: (projectId) => set((state) => {
        if (!projectId || !isValidProjectId(projectId)) return {};
        const isAdmin = state.user?.role === 'admin';
        const projectIds = state.user?.projectIds || [];
        if (!isAdmin && !projectIds.includes(projectId)) return {};
        return { currentProjectId: projectId };
      }),
      logout: () => set({ token: null, user: null, currentProjectId: null }),
    }),
    {
      name: 'wlight-web-auth',
    }
  )
);
