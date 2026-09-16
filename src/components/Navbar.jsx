import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { getAccountInitials } from '../lib/avatar'
import { DAMAGE_TYPES } from '../lib/damageTypes'
import { supabase } from '../lib/supabaseclient'
import { getAppSettings } from '../lib/appSettings'
import './Navbar.css'

const baseLinks = [
  { path: '/dashboard', label: 'Beranda', icon: '/icons/beranda.svg?v=sijaka5' },
  { path: '/map', label: 'Peta', icon: '/icons/peta.svg?v=sijaka5' },
  { path: '/my-reports', label: 'Laporan', icon: '/icons/laporan.svg?v=sijaka5' },
  { path: '/profile', label: 'Profil', icon: '/icons/profil.svg?v=sijaka5' },
]

const NOTIFICATION_LIMIT = 30

function notificationKey(userId) {
  return `sijaka-notifications-${userId}`
}

function snapshotKey(userId, role) {
  return `sijaka-notification-snapshot-${role}-${userId}`
}

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function formatNotificationDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Baru saja'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function notificationText(report, role, previousStatus) {
  const damageLabel = DAMAGE_TYPES[report.damage_type]?.label || 'Kerusakan Jalan'
  if (role === 'admin' || role === 'community') {
    return previousStatus
      ? `Laporan ${damageLabel} berubah menjadi ${report.status}.`
      : `Laporan baru masuk: ${damageLabel}.`
  }
  return `Status laporan Anda berubah menjadi ${report.status}.`
}

function normalizeNotification(item) {
  const message = String(item?.message || '')
  const damageType = item?.damageType || Object.keys(DAMAGE_TYPES).find((key) => message.toLowerCase().includes(key))
  const damageLabel = damageType ? DAMAGE_TYPES[damageType]?.label : null
  return {
    ...item,
    damageType: damageType || item?.damageType || null,
    message: damageLabel
      ? message.replace(new RegExp(`\\b${damageType}\\b`, 'i'), damageLabel)
      : message,
  }
}

export default function Navbar() {
  const { user, role, fullName, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [guestNotice, setGuestNotice] = useState(false)
  const [guestNoticeClosing, setGuestNoticeClosing] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [clearInboxConfirm, setClearInboxConfirm] = useState(false)
  const [swipeState, setSwipeState] = useState({ id: null, offset: 0 })
  const snapshotRef = useRef({})
  const notificationKeyRef = useRef('')
  const dragStartRef = useRef({ id: null, x: 0 })
  const guestNoticeTimerRef = useRef(null)
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.avatarUrl || ''
  const userInitials = getAccountInitials(fullName || user?.user_metadata?.full_name, user?.email)

  useEffect(() => {
    if (!user?.id || !role || !getAppSettings().notifications) {
      setNotifications([])
      return undefined
    }

    const key = notificationKey(user.id)
    const stateKey = snapshotKey(user.id, role)
    notificationKeyRef.current = key
    const storedNotifications = readJson(key, []).map(normalizeNotification)
    setNotifications(storedNotifications)
    window.localStorage.setItem(key, JSON.stringify(storedNotifications))
    snapshotRef.current = readJson(stateKey, {})
    let active = true

    const persistNotifications = (next) => {
      const trimmed = next.slice(0, NOTIFICATION_LIMIT)
      window.localStorage.setItem(key, JSON.stringify(trimmed))
      if (active) setNotifications(trimmed)
    }

    const addNotification = (report, previousStatus = null) => {
      if (!report?.id || (role !== 'admin' && role !== 'community' && !previousStatus)) return
      const id = `${report.id}-${report.status}-${previousStatus || 'new'}`
      const current = readJson(key, [])
      if (current.some((item) => item.id === id)) return
      const next = [{
        id,
        reportId: report.id,
        title: role === 'admin' || role === 'community' ? (previousStatus ? 'Pembaruan laporan' : 'Laporan baru masuk') : 'Pembaruan laporan',
        message: notificationText(report, role, previousStatus),
        damageType: report.damage_type || null,
        createdAt: new Date().toISOString(),
        read: false,
      }, ...current]
      persistNotifications(next)
      window.dispatchEvent(new CustomEvent('sijaka:notification', { detail: { title: next[0].title, message: next[0].message } }))
    }

    const reconcile = async () => {
      let query = supabase
        .from('reports')
        .select('id, user_id, status, damage_type, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (role !== 'admin' && role !== 'community') query = query.eq('user_id', user.id)
      const { data, error } = await query
      if (!active || error) return
      const nextSnapshot = {}
      ;(data || []).forEach((report) => {
        nextSnapshot[report.id] = { status: report.status, createdAt: report.created_at }
        const previous = snapshotRef.current[report.id]
        if (previous && previous.status !== report.status) addNotification(report, previous.status)
        if (!previous && role === 'admin' && snapshotRef.current.__initialized) addNotification(report)
      })
      nextSnapshot.__initialized = true
      snapshotRef.current = nextSnapshot
      window.localStorage.setItem(stateKey, JSON.stringify(nextSnapshot))
    }

    reconcile()
    const channel = supabase
      .channel(`inbox-${role}-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
        const report = payload.new
        if (!report?.id) return
        if (role !== 'admin' && role !== 'community' && report.user_id !== user.id) return
        const previous = snapshotRef.current[report.id]
        if (payload.eventType === 'INSERT') {
          if (role === 'admin' || role === 'community') addNotification(report)
          else if (report.status) addNotification(report, 'Diterima')
        }
        if (payload.eventType === 'UPDATE' && report.status && previous?.status !== report.status) addNotification(report, previous?.status || null)
        snapshotRef.current[report.id] = { status: report.status, createdAt: report.created_at }
      })
      .subscribe()
    const timer = window.setInterval(reconcile, 30000)

    return () => {
      active = false
      window.clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [role, user?.id])

  const unreadCount = notifications.filter((item) => !item.read).length
  const openInbox = () => {
    setInboxOpen((open) => !open)
    const next = notifications.map((item) => ({ ...item, read: true }))
    setNotifications(next)
    if (notificationKeyRef.current) window.localStorage.setItem(notificationKeyRef.current, JSON.stringify(next))
  }

  const deleteNotification = (notificationId) => {
    if (!notificationKeyRef.current) return
    const next = notifications.filter((item) => item.id !== notificationId)
    window.localStorage.setItem(notificationKeyRef.current, JSON.stringify(next))
    setNotifications(next)
    setSwipeState({ id: null, offset: 0 })
    dragStartRef.current = { id: null, x: 0 }
  }

  const handleNotificationPointerDown = (event, notificationId) => {
    dragStartRef.current = { id: notificationId, x: event.clientX }
    setSwipeState({ id: notificationId, offset: 0 })
  }

  const handleNotificationPointerMove = (event, notificationId) => {
    if (dragStartRef.current.id !== notificationId) return
    const deltaX = event.clientX - dragStartRef.current.x
    if (deltaX < 0) {
      setSwipeState({ id: notificationId, offset: Math.max(deltaX, -130) })
    }
  }

  const handleNotificationPointerEnd = (notificationId) => {
    if (swipeState.id !== notificationId) return
    if (swipeState.offset <= -96) {
      deleteNotification(notificationId)
      return
    }
    setSwipeState({ id: null, offset: 0 })
    dragStartRef.current = { id: null, x: 0 }
  }

  const clearInbox = () => {
    if (!notificationKeyRef.current) return
    window.localStorage.setItem(notificationKeyRef.current, JSON.stringify([]))
    setNotifications([])
    setClearInboxConfirm(false)
  }

  useEffect(() => {
    const showGuestNotice = () => {
      setGuestNoticeClosing(false)
      setGuestNotice(true)
    }
    window.addEventListener('sijaka:guest-report', showGuestNotice)
    return () => {
      window.removeEventListener('sijaka:guest-report', showGuestNotice)
      window.clearTimeout(guestNoticeTimerRef.current)
    }
  }, [])

  const closeGuestNotice = () => {
    setGuestNoticeClosing(true)
    window.clearTimeout(guestNoticeTimerRef.current)
    guestNoticeTimerRef.current = window.setTimeout(() => {
      setGuestNotice(false)
      setGuestNoticeClosing(false)
    }, 220)
  }
  const openGuestNotice = () => {
    setGuestNoticeClosing(false)
    setGuestNotice(true)
  }
  const isStaff = ['admin', 'community'].includes(role)
  const roleLinks = isStaff
    ? baseLinks.filter((link) => !['/profile', '/my-reports'].includes(link.path))
    : baseLinks.filter((link) => link.path !== '/profile')
  const guestLinks = roleLinks.map((link) => {
    if (!user && link.path === '/my-reports') {
      return { ...link, requiresLogin: true }
    }
    if (!user && link.path === '/profile') {
      return { ...link, label: 'Profil' }
    }
    return link
  })
  const links = !loading && ['admin', 'community'].includes(role)
    ? [...guestLinks, { path: role === 'community' ? '/community' : '/admin', label: role === 'community' ? 'Relawan' : 'Instansi', icon: '/icons/admin.svg?v=sijaka5' }]
    : guestLinks.map((link) => {
        if (link.path === '/my-reports' && user) return { ...link, label: 'Laporan Saya' }
        if (link.path === '/history' && user) return { ...link, label: 'Riwayat Saya' }
        return link
      })

  return (
    <>
      <header className="navbar-shell">
        <nav className="navbar" aria-label="Navigasi utama">
          <Link to="/dashboard" className="navbar-brand" aria-label="SIJAKA, kembali ke beranda">
            <img src="/logo-sijaka.png" alt="" className="navbar-logo" />
            <span>SIJAKA</span>
          </Link>

          <div className="navbar-links" role="list">
            {links.map((link) => {
              const active = location.pathname === link.path
              if (link.requiresLogin) {
                return (
                  <button
                    key={link.path}
                    type="button"
                    className="navbar-link navbar-action-button"
                    onClick={openGuestNotice}
                    aria-haspopup="dialog"
                  >
                    <span className="navbar-icon" aria-hidden="true"><img src={link.icon} alt="" /></span>
                    <span className="navbar-label">{link.label}</span>
                  </button>
                )
              }
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`navbar-link ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="navbar-icon" aria-hidden="true"><img src={active && link.path === '/dashboard' ? '/icons/beranda-active.svg?v=sijaka5' : link.icon} alt="" /></span>
                  <span className="navbar-label">{link.label}</span>
                </Link>
              )
            })}
          </div>

          {!loading && (
            user ? (
              <div className="navbar-user-tools">
                <button type="button" className={`navbar-inbox-button ${inboxOpen ? 'active' : ''}`} onClick={openInbox} aria-label={`Buka inbox${unreadCount ? `, ${unreadCount} belum dibaca` : ''}`} aria-expanded={inboxOpen}>
                  <img src="/icons/inbox.svg" alt="" aria-hidden="true" />
                  {unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}
                </button>
                <Link to="/profile" className="navbar-account" aria-label="Buka profil">
                  <span className="navbar-account-avatar" aria-hidden="true">
                    {userAvatar ? <img src={userAvatar} alt="" className="navbar-account-avatar-image" /> : userInitials}
                  </span>
                  <span className="navbar-account-name">{fullName || 'Profil saya'}</span>
                </Link>
              </div>
            ) : (
              <Link to="/profile" className="navbar-account navbar-account-guest" aria-label="Buka profil User">
                <span className="navbar-account-avatar" aria-hidden="true">U</span>
                <span className="navbar-account-name">User</span>
              </Link>
            )
          )}
        </nav>
      </header>

      {inboxOpen && user && (
        <div className="navbar-inbox" role="dialog" aria-label="Inbox notifikasi">
          <div className="navbar-inbox-head">
            <strong>Inbox</strong>
            <div className="navbar-inbox-head-actions">
              <button type="button" onClick={() => setInboxOpen(false)} aria-label="Tutup inbox">×</button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <p className="navbar-inbox-empty">Belum ada notifikasi.</p>
          ) : (
            <div className="navbar-inbox-list">
              {notifications.map((item) => {
                const isSwiping = swipeState.id === item.id
                return (
                  <div className="navbar-inbox-item-wrap" key={item.id}>
                    <div className="navbar-inbox-swipe-delete" aria-hidden="true">Hapus</div>
                    <button
                      type="button"
                      className={`navbar-inbox-item ${item.read ? '' : 'unread'} ${isSwiping ? 'swiping' : ''}`}
                      style={{ transform: isSwiping ? `translateX(${swipeState.offset}px)` : 'translateX(0px)' }}
                      onPointerDown={(event) => handleNotificationPointerDown(event, item.id)}
                      onPointerMove={(event) => handleNotificationPointerMove(event, item.id)}
                      onPointerUp={() => handleNotificationPointerEnd(item.id)}
                      onPointerLeave={() => handleNotificationPointerEnd(item.id)}
                      onClick={() => {
                        if (swipeState.id === item.id && swipeState.offset !== 0) return
                        setInboxOpen(false)
                        navigate(role === 'admin' ? `/admin?refresh=${Date.now()}` : role === 'community' ? '/community' : '/my-reports')
                      }}
                    >
                      {item.damageType && DAMAGE_TYPES[item.damageType]?.icon ? (
                        <span className="navbar-inbox-icon" aria-hidden="true">
                          <img src={DAMAGE_TYPES[item.damageType].icon} alt="" />
                        </span>
                      ) : (
                        <span className="navbar-inbox-dot" aria-hidden="true" />
                      )}
                      <span><strong>{item.title}</strong><small>{item.message}</small><time>{formatNotificationDate(item.createdAt)}</time></span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          {notifications.length > 0 && (
            <div className="navbar-inbox-footer">
              <button type="button" className="navbar-inbox-clear" onClick={() => setClearInboxConfirm(true)}>Hapus semua notifikasi</button>
            </div>
          )}
        </div>
      )}

      {clearInboxConfirm && (
        <div className="navbar-confirm-backdrop" role="presentation" onClick={() => setClearInboxConfirm(false)}>
          <section className="navbar-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-inbox-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="clear-inbox-title">Hapus semua notifikasi?</h2>
            <p>Semua pesan di inbox akan dihapus dari perangkat ini.</p>
            <div className="navbar-confirm-actions">
              <button type="button" onClick={() => setClearInboxConfirm(false)}>Batal</button>
              <button type="button" className="danger" onClick={clearInbox}>Hapus semua</button>
            </div>
          </section>
        </div>
      )}

      {guestNotice && (
        <div className="navbar-guest-popup-backdrop" role="presentation">
          <div className={`navbar-guest-popup ${guestNoticeClosing ? 'closing' : ''}`} role="dialog" aria-live="polite" aria-label="Lapor Kerusakan">
            <img src="/icons/lapor.svg" alt="" />
            <span className="navbar-guest-popup-copy">
              <strong>Lapor Kerusakan</strong>
              <small>Login diperlukan untuk melapor</small>
            </span>
            <Link to="/login" className="navbar-guest-popup-login" onClick={closeGuestNotice}>Masuk untuk melapor</Link>
            <button type="button" className="navbar-guest-popup-close" onClick={closeGuestNotice} aria-label="Tutup notifikasi">×</button>
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav" style={{ '--mobile-nav-items': links.length }} aria-label="Navigasi mobile">
        {links.map((link) => {
          const active = location.pathname === link.path
          if (link.requiresLogin) {
            return (
              <button
                key={link.path}
                type="button"
                className="mobile-nav-link mobile-nav-action-button"
                onClick={openGuestNotice}
                aria-haspopup="dialog"
              >
                <span className="mobile-nav-icon" aria-hidden="true"><img src={link.icon} alt="" /></span>
                <span>{link.label}</span>
              </button>
            )
          }
          return (
            <Link key={link.path} to={link.path} className={`mobile-nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
              <span className="mobile-nav-icon" aria-hidden="true"><img src={link.icon} alt="" /></span>
              <span>{link.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
