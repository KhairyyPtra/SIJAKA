import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseclient'
import { validatePassword } from '../lib/validation'
import './Auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()

  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const redirectTimerRef = useRef(null)

  useEffect(() => {
    let mounted = true
    let subscription

    const checkRecoverySession = async () => {
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return

        if ((event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION') && session) {
          setReady(true)
          setChecking(false)
        }
      })
      subscription = authSubscription

      try {
        const callbackUrl = new URL(window.location.href)
        const hashParams = new URLSearchParams(callbackUrl.hash.slice(1))
        const callbackError = callbackUrl.searchParams.get('error_description')
          || callbackUrl.searchParams.get('error')
          || hashParams.get('error_description')
          || hashParams.get('error')

        if (callbackError) {
          setError(callbackError)
          setChecking(false)
          return
        }

        const code = callbackUrl.searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
          callbackUrl.searchParams.delete('code')
          window.history.replaceState({}, document.title, callbackUrl.toString())
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!mounted) return

        if (session) {
          setReady(true)
        } else {
          setError('Link reset tidak valid atau sudah kedaluwarsa. Minta link reset baru lalu coba lagi.')
        }

        setChecking(false)
      } catch (err) {
        if (!mounted) return
        console.error('Recovery session error:', err)
        setError('Tautan pengaturan ulang tidak dapat digunakan. Minta tautan baru lalu coba lagi.')
        setChecking(false)
      }
    }

    checkRecoverySession()

    return () => {
      mounted = false
      subscription?.unsubscribe()
      clearTimeout(redirectTimerRef.current)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError('Password baru belum dapat disimpan. Coba lagi sebentar.')
        return
      }
      setSuccess(true)
      redirectTimerRef.current = setTimeout(() => navigate('/login'), 1500)
    } catch {
      setError('Password belum berhasil diperbarui. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">

        {}
        <div className="auth-logo">
          <img
            src="/logo-sijaka.png"
            alt="SIJAKA"
            className="auth-logo-img"
          />
        </div>

        {}
        <h2 className="auth-title">
          Atur Ulang Password
        </h2>

        <p className="auth-subtitle">
          Buat password baru untuk akun kamu
        </p>

        {}
        {checking && (
          <div className="auth-success">
            Memverifikasi link reset password...
          </div>
        )}

        {}
        {!checking && !ready && !success && (
          <div className="auth-error">
            {error || 'Link reset tidak valid atau sudah kedaluwarsa.'}
            <br />
            Silakan minta link reset baru.
          </div>
        )}

        {}
        {success && (
          <div className="auth-success">
            Password berhasil diperbarui!
            <br />
            Mengarahkan ke halaman login...
          </div>
        )}

        {}
        {!checking && ready && !success && (
          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >

            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            {}
            <div className="auth-input-group">
              <label>
                Password baru
              </label>

              <div
                style={{
                  position: 'relative',
                  width: '100%',
                }}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  style={{
                    width: '100%',
                    paddingRight: '48px',
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? 'Sembunyikan password'
                      : 'Tampilkan password'
                  }
                  title={
                    showPassword
                      ? 'Sembunyikan password'
                      : 'Tampilkan password'
                  }
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '18px',
                    lineHeight: 1,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                    style={{ width: '20px', height: '20px', display: 'block' }}
                  >
                    {showPassword ? (
                      <>
                        <path
                          d="M3 3l18 18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.3 0 9.9 6 9.9 6a18.3 18.3 0 0 1-3.1 3.7M6.4 6.9C3.7 8.6 2.1 12 2.1 12s3.6 6 9.9 6c1.6 0 3-.4 4.2-.9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    ) : (
                      <>
                        <path
                          d="M2.1 12s3.6-6 9.9-6 9.9 6 9.9 6-3.6 6-9.9 6-9.9-6-9.9-6Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="2.8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {}
            <div className="auth-input-group">
              <label>
                Konfirmasi password baru
              </label>

              <div
                style={{
                  position: 'relative',
                  width: '100%',
                }}
              >
                <input
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  minLength={6}
                  required
                  style={{
                    width: '100%',
                    paddingRight: '48px',
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Sembunyikan password'
                      : 'Tampilkan password'
                  }
                  title={
                    showConfirmPassword
                      ? 'Sembunyikan password'
                      : 'Tampilkan password'
                  }
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '18px',
                    lineHeight: 1,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                    style={{ width: '20px', height: '20px', display: 'block' }}
                  >
                    {showConfirmPassword ? (
                      <>
                        <path
                          d="M3 3l18 18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.3 0 9.9 6 9.9 6a18.3 18.3 0 0 1-3.1 3.7M6.4 6.9C3.7 8.6 2.1 12 2.1 12s3.6 6 9.9 6c1.6 0 3-.4 4.2-.9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    ) : (
                      <>
                        <path
                          d="M2.1 12s3.6-6 9.9-6 9.9 6 9.9 6-3.6 6-9.9 6-9.9-6-9.9-6Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="2.8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {}
            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading
                ? 'Menyimpan...'
                : 'Simpan Password Baru'}
            </button>

          </form>
        )}

        {}
        <div className="auth-footer">
          <Link to="/forgot-password">
            Minta link reset baru
          </Link>
        </div>

      </div>
    </div>
  )
}
