import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const SHORTCUTS = {
  '1': '/dashboard',
  '2': '/map',
  '3': '/report',
  '4': '/my-reports',
  '5': '/profile',
}

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
  )
}

export default function PlatformShell({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { role } = useAuth()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [runtimeError, setRuntimeError] = useState(false)
  const refreshingRef = useRef(false)
  const [notification, setNotification] = useState(null)
  const roleMessages = role === 'admin'
    ? {
        offline: 'Koneksi terputus. Data panel instansi yang tersimpan masih ditampilkan.',
        error: 'Panel instansi belum dapat memproses permintaan ini.',
      }
    : role === 'community'
      ? {
          offline: 'Koneksi terputus. Data ruang kerja relawan yang tersimpan masih ditampilkan.',
          error: 'Ruang kerja relawan belum dapat memproses permintaan ini.',
        }
      : role === 'user'
        ? {
            offline: 'Koneksi terputus. Data laporan Anda yang tersimpan masih ditampilkan.',
            error: 'Laporan Anda belum dapat diproses. Coba lagi sebentar.',
          }
        : {
            offline: 'Koneksi terputus. Sebagian informasi mungkin belum terbaru.',
            error: 'Halaman belum dapat dimuat. Coba lagi sebentar.',
          }

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const handleNotification = (event) => {
      const detail = event.detail
      if (!detail?.message) return
      setNotification({ title: detail.title || 'Pembaruan SIJAKA', message: detail.message })
      window.clearTimeout(handleNotification.timer)
      handleNotification.timer = window.setTimeout(() => setNotification(null), 5200)
    }
    window.addEventListener('sijaka:notification', handleNotification)
    return () => {
      window.removeEventListener('sijaka:notification', handleNotification)
      window.clearTimeout(handleNotification.timer)
    }
  }, [])

  useEffect(() => {
    const isTransientMapError = (message = '') => message.includes('_leaflet_pos')
    const handleRuntimeError = (event) => {
      if (isTransientMapError(event?.message || event?.error?.message)) return
      setRuntimeError(true)
    }
    const handleUnhandledRejection = (event) => {
      if (isTransientMapError(event?.reason?.message || event?.reason)) return
      setRuntimeError(true)
    }

    window.addEventListener('error', handleRuntimeError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleRuntimeError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    setRuntimeError(false)
  }, [pathname])

  useEffect(() => {
    const handleShortcut = (event) => {
      if (isEditableTarget(event.target) || !event.altKey) return
      const path = SHORTCUTS[event.key]
      if (!path) return
      event.preventDefault()
      navigate(path)
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [navigate])

  useEffect(() => {
    let startY = 0
    let tracking = false

    const handleTouchStart = (event) => {
      if (window.scrollY === 0 && event.touches.length === 1) {
        startY = event.touches[0].clientY
        tracking = true
      }
    }

    const handleTouchEnd = (event) => {
      if (!tracking) return
      tracking = false
      const distance = event.changedTouches[0].clientY - startY
      if (distance < 88 || !navigator.onLine || refreshingRef.current) return
      refreshingRef.current = true
      window.location.reload()
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return (
    <div className={`platform-role-shell role-${role || 'guest'}`} data-role={role || 'guest'}>
      {!online && (
        <div className="platform-status" role="status" aria-live="polite">
          {roleMessages.offline}
        </div>
      )}
      {runtimeError && (
        <div className="platform-status platform-status-error" role="alert">
          {roleMessages.error}
          <button type="button" onClick={() => window.location.reload()}>Coba lagi</button>
        </div>
      )}
      {notification && (
        <div className="sijaka-toast" role="status" aria-live="polite">
          <span className="sijaka-toast-mark" aria-hidden="true">✓</span>
          <span className="sijaka-toast-copy">
            <strong>{notification.title}</strong>
            <span>{notification.message}</span>
          </span>
          <button type="button" onClick={() => setNotification(null)} aria-label="Tutup pemberitahuan">×</button>
        </div>
      )}
      {children}
    </div>
  )
}