'use client'

import { useEffect, useState } from 'react'
import { useNotifications, type Notification } from '@/app/lib/useNotifications'

export default function NotificationCenter() {
  const { notifications, removeNotification } = useNotifications()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      maxWidth: 360, pointerEvents: 'none',
    }}>
      {notifications.map(n => (
        <NotificationItem key={n.id} notification={n} onClose={() => removeNotification(n.id)} />
      ))}
    </div>
  )
}

const CONFIGS = {
  success: { bg: '#F0FDF4', border: '#86EFAC', text: '#166534', icon: '✓', iconColor: '#16A34A' },
  error:   { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', icon: '✕', iconColor: '#DC2626' },
  warning: { bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', icon: '⚠', iconColor: '#D97706' },
  info:    { bg: '#EFF6FF', border: '#93C5FD', text: '#1E3A5F', icon: 'ℹ', iconColor: '#2563EB' },
}

function NotificationItem({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  useEffect(() => {
    if (!notification.duration) return
    const t = setTimeout(onClose, notification.duration)
    return () => clearTimeout(t)
  }, [notification.duration, onClose])

  const c = CONFIGS[notification.type]

  return (
    <div role="alert" style={{
      pointerEvents: 'auto',
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      color: c.text,
      fontFamily: 'var(--font-sans)',
    }}>
      <span style={{ color: c.iconColor, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
      <div style={{ flex: 1 }}>
        {notification.title && (
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{notification.title}</div>
        )}
        <div style={{ fontSize: 12, opacity: 0.9 }}>{notification.message}</div>
      </div>
      <button onClick={onClose} aria-label="Fermer" style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: c.text, opacity: 0.5, fontSize: 13, padding: 0, flexShrink: 0,
      }}>✕</button>
    </div>
  )
}
