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

  if (currentProjectId && (isAdmin || projectIds.includes(currentProjectId))) {
    return currentProjectId;
  }

  return projectIds[0] || null;
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
        if (!projectId) return {};
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
