import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'


export default function AdminRoute({ children, allowedRole = 'admin' }) {
  const { user, role, profileError, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <div className="app-loading-spinner" />
        <span>Memuat panel…</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profileError || role === null || role === undefined) {
    return (
      <main className="app-crash" role="alert">
        <div className="app-crash-card">
          <img src="/logo-sijaka.png" alt="SIJAKA" className="app-crash-logo" />
          <h1>Panel belum siap dibuka</h1>
          <p>
            {profileError ||
              'Informasi akun Anda sedang disiapkan. Coba lagi sebentar.'}
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Muat ulang panel
          </button>
        </div>
      </main>
    )
  }

  const isStaff = role === 'admin' || role === 'community'

  if (!isStaff) {
    return <Navigate to="/dashboard" replace />
  }

  if (allowedRole === 'any') {
    return children
  }

  if (role !== allowedRole) {
    if (role === 'community') {
      return <Navigate to="/community" replace />
    }
    if (role === 'admin') {
      return <Navigate to="/admin" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return children
}
