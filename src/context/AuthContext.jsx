import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseclient'

export const AuthContext = createContext()

function normalizeRole(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (['admin', 'pemerintah', 'government', 'instansi'].includes(normalized)) return 'admin'
  if (['community', 'komunitas'].includes(normalized)) return 'community'
  return 'user'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [fullName, setFullName] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [loading, setLoading] = useState(true)
  const profileRequest = useRef(0)
  const mountedRef = useRef(false)

  const fetchProfile = useCallback(async (userId) => {
    const requestId = ++profileRequest.current
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .maybeSingle()

      if (!mountedRef.current || requestId !== profileRequest.current) return

      if (error) {
        console.warn('Profil pengguna tidak dapat dimuat:', error.message)
        setProfileError('Informasi akun belum siap. Periksa koneksi lalu coba lagi.')
        setRole(null)
        setFullName(null)
        return
      }

      setProfileError('')
      setRole(normalizeRole(data?.role))
      setFullName(data?.full_name || null)
    } catch (error) {
      if (!mountedRef.current || requestId !== profileRequest.current) return
      console.warn('Profil pengguna tidak dapat dimuat:', error)
      setProfileError('Informasi akun belum siap. Periksa koneksi lalu coba lagi.')
      setRole(null)
      setFullName(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    mountedRef.current = true

    const initialise = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setRole(null)
          setFullName(null)
          setProfileError('')
        }
      } catch (error) {
        if (!mounted) return
        console.error('Sesi autentikasi tidak dapat dipulihkan:', error)
        setUser(null)
        setRole(null)
        setFullName(null)
        setProfileError('Sesi Anda belum siap. Silakan masuk kembali untuk melanjutkan.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initialise()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        queueMicrotask(() => fetchProfile(session.user.id))
      } else {
        ++profileRequest.current
        setRole(null)
        setFullName(null)
        setProfileError('')
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      ++profileRequest.current
      listener.subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = (email, password, fullName) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()
  const isAdmin = role === 'admin'
  const isCommunity = role === 'community'
  const canManageReports = isAdmin || isCommunity

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, isCommunity, canManageReports, fullName, profileError, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
