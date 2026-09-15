import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useNavigate, Link } from 'react-router-dom'
import { setRememberMe } from '../lib/supabaseclient'
import { normalizeEmail, validateEmail, validatePassword } from '../lib/validation'
import './Auth.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    const normalizedEmail = normalizeEmail(email)
    const emailError = validateEmail(normalizedEmail)
    const passwordError = validatePassword(password)
    if (emailError || passwordError) {
      setError(emailError || passwordError)
      return
    }

    setLoading(true)

    try {
      setRememberMe(remember)
      const { error } = await signIn(normalizedEmail, password)

      if (error) setError('Email atau password belum sesuai. Periksa kembali lalu coba lagi.')
      else navigate('/dashboard')
    } catch {
      setError('Anda belum dapat masuk. Periksa koneksi lalu coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">

        <div className="auth-logo">
          <img
            src="/logo-sijaka.png"
            alt="SIJAKA"
            className="auth-logo-img"
          />
        </div>

        <h2 className="auth-title">Masuk ke SIJAKA</h2>

        <p className="auth-subtitle">
          Layanan Laporan Kerusakan Jalan
        </p>

        <form className="auth-form" onSubmit={handleLogin}>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {}
          <div className="auth-input-group">
            <label>Email</label>

            <input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {}
          <div className="auth-input-group">
            <label>Password</label>

            <div
              style={{
                position: 'relative',
                width: '100%',
              }}
            >
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  paddingRight: '48px',
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
                  right: '10px',
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
                  zIndex: 2,
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '-4px',
            }}
          >

            <label
              className="auth-remember-me"
              style={{ margin: 0 }}
            >
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />

              <span>Ingat saya</span>
            </label>

            <Link
              to="/forgot-password"
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--accent)',
              }}
            >
              Lupa password?
            </Link>

          </div>

          {}
          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>

        </form>

        {}
        <div className="auth-footer">
          Belum punya akun?{' '}
          <Link to="/register">
            Buat akun
          </Link>
        </div>

        <Link to="/dashboard" className="auth-back-dashboard">
          Kembali ke Dashboard
        </Link>

      </div>
    </div>
  )
}
