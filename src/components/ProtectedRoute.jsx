import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute({ children, allowGuest = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="app-loading" role="status" aria-live="polite"><div className="app-loading-spinner" /><span>Memuat SIJAKA...</span></div>
  }

  if (!user && !allowGuest) return <Navigate to="/login" replace />
  return children
}
