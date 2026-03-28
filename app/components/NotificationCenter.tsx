'use client'

import { useEffect, useState } from 'react'
import { useNotifications, type Notification } from '@/app/lib/useNotifications'

export default function NotificationCenter() {
  const { notifications, removeNotification } = useNotifications()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm" style={{ pointerEvents: 'none' }}>
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  )
}

function NotificationItem({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  useEffect(() => {
    if (!notification.duration) return
    const timer = setTimeout(onClose, notification.duration)
    return () => clearTimeout(timer)
  }, [notification.duration, onClose])

  const styleConfig = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: '✓',
      iconColor: 'text-green-600',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: '✕',
      iconColor: 'text-red-600',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: '⚠',
      iconColor: 'text-yellow-600',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'ℹ',
      iconColor: 'text-blue-600',
    },
  }

  const config = styleConfig[notification.type]

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-lg p-4 shadow-lg flex items-start gap-3 ${config.text} animate-in slide-in-from-right-5 fade-in duration-200`}
      style={{ pointerEvents: 'auto' }}
      role="alert"
    >
      <span className={`${config.iconColor} font-bold flex-shrink-0 mt-0.5`}>{config.icon}</span>
      <div className="flex-1">
        {notification.title && (
          <div className="font-semibold text-sm mb-0.5">{notification.title}</div>
        )}
        <div className="text-sm opacity-90">{notification.message}</div>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  )
}
