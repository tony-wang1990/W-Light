import { create } from 'zustand';
import { Notification } from '../types';
import client from '../api/client';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
}

interface NotificationActions {
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  decrementUnread: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

type NotificationListResponse = { items?: Notification[]; unreadCount?: number } | [Notification[], number] | Notification[];

function isNotificationTuple(response: NotificationListResponse): response is [Notification[], number] {
  return Array.isArray(response) && response.length === 2 && Array.isArray(response[0]) && typeof response[1] === 'number';
}

function normalizeNotificationResponse(
  response: NotificationListResponse,
) {
  if (isNotificationTuple(response)) {
    const [items] = response;
    return {
      items,
      unreadCount: items.filter(item => !item.isRead).length,
    };
  }

  if (Array.isArray(response)) {
    return {
      items: response,
      unreadCount: response.filter(item => !item.isRead).length,
    };
  }

  return {
    items: response.items || [],
    unreadCount: response.unreadCount ?? (response.items || []).filter(item => !item.isRead).length,
  };
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  // State
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  // Actions
  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const response = await client.get<NotificationListResponse>('/notifications');
      const normalized = normalizeNotificationResponse(response);
      set({
        notifications: normalized.items,
        unreadCount: normalized.unreadCount,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await client.put(`/notifications/${id}/read`);
      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Silently fail
    }
  },

  markAllAsRead: async () => {
    try {
      await client.put('/notifications/read-all');
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail
    }
  },

  addNotification: (notification: Notification) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.isRead
        ? state.unreadCount
        : state.unreadCount + 1,
    }));
  },

  decrementUnread: () => {
    set(state => ({
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },
}));
