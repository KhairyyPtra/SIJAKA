import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useNavigate, Link } from 'react-router-dom'
import { normalizeEmail, validateEmail, validatePassword, validateRequiredText } from '../lib/validation'
import './Auth.css'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const redirectTimer = useRef(null)

  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    const normalizedName = fullName.trim()
    const normalizedEmail = normalizeEmail(email)
    const validationError = validateRequiredText(normalizedName, 'Nama lengkap') || validateEmail(normalizedEmail) || validatePassword(password)
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)

    try {
      const { data, error } = await signUp(normalizedEmail, password, normalizedName)
      if (error) {
        setError('Akun belum dapat dibuat. Periksa data Anda lalu coba lagi.')
      } else {
        setSuccess(true)
        redirectTimer.current = setTimeout(() => {
          if (data?.session) {
            navigate('/dashboard', { replace: true })
          } else {
            navigate('/verify-otp', { state: { email: normalizedEmail } })
          }
        }, 1000)
      }
    } catch {
      setError('Pendaftaran belum berhasil. Periksa koneksi lalu coba lagi.')
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
          Buat Akun Baru
        </h2>

        <p className="auth-subtitle">
          Daftar untuk mulai melapor kerusakan jalan
        </p>

        {}
        <form
          className="auth-form"
          onSubmit={handleRegister}
        >

          {}
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {}
          {success && (
            <div className="auth-success">
              Registrasi berhasil! Mengarahkan ke verifikasi OTP...
            </div>
          )}

          {}
          <div className="auth-input-group">
            <label>
              Nama Lengkap
            </label>

            <input
              type="text"
              placeholder="Nama kamu"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {}
          <div className="auth-input-group">
            <label>
              Email
            </label>

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
            <label>
              Password
            </label>

            <div
              style={{
                position: 'relative',
                width: '100%',
              }}
            >

              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
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

              {}
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
          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading
              ? 'Mendaftarkan...'
              : 'Daftar'}
          </button>

        </form>

        {}
        <div className="auth-footer">
          Sudah punya akun?{' '}
          <Link to="/login">
            Masuk di sini
          </Link>
        </div>

      </div>
    </div>
  )
}
