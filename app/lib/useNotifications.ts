import { create } from 'zustand'

export type Notification = {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
}

type NotificationStore = {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const useNotifications = create<NotificationStore>(set => ({
  notifications: [],
  
  addNotification: (notification) => set(state => ({
    notifications: [
      ...state.notifications,
      {
        ...notification,
        id: Math.random().toString(36).substr(2, 9),
        duration: notification.duration ?? 5000,
      },
    ],
  })),

  removeNotification: (id) => set(state => ({
    notifications: state.notifications.filter(n => n.id !== id),
  })),

  clearNotifications: () => set({ notifications: [] }),
}))

// Convenience hooks
export function useErrorHandler() {
  const { addNotification } = useNotifications()

  return {
    error: (message: string, title = 'Erreur') => {
      addNotification({
        type: 'error',
        title,
        message,
        duration: 6000,
      })
    },
    success: (message: string, title = 'Succès') => {
      addNotification({
        type: 'success',
        title,
        message,
        duration: 4000,
      })
    },
    warning: (message: string, title = 'Attention') => {
      addNotification({
        type: 'warning',
        title,
        message,
        duration: 5000,
      })
    },
    info: (message: string, title = 'Information') => {
      addNotification({
        type: 'info',
        title,
        message,
        duration: 4000,
      })
    },
  }
}
