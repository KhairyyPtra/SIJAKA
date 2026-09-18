import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseclient'
import { validateEmail } from '../lib/validation'
import './Auth.css'

export default function VerifyOtp() {
  const location = useLocation()
  const navigate = useNavigate()
  const emailFromState = location.state?.email || (() => {
    try {
      return sessionStorage.getItem('sijaka-pending-signup-email') || ''
    } catch {
      return ''
    }
  })()

  const [email] = useState(emailFromState)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [info, setInfo] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!emailFromState) {
      navigate('/register', { replace: true })
    }
  }, [emailFromState, navigate])

  useEffect(() => {
    if (!email) return
    try {
      sessionStorage.setItem('sijaka-pending-signup-email', email)
    } catch {
    }
  }, [email])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (validateEmail(email) || otp.trim().length !== 6) {
      setError(validateEmail(email) || 'Kode OTP harus terdiri dari 6 digit.')
      return
    }
    setLoading(true)

    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'signup' })
      if (error) setError('Kode verifikasi belum sesuai. Periksa email Anda lalu coba lagi.')
      else {
        try {
          sessionStorage.removeItem('sijaka-pending-signup-email')
        } catch {
        }
        navigate('/dashboard')
      }
    } catch {
      setError('Verifikasi belum berhasil. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setResending(true)
    setError('')
    setInfo('')

    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) setError('Kode baru belum dapat dikirim. Coba lagi sebentar.')
      else {
        setInfo('Kode OTP baru telah dikirim ke email kamu.')
        setCooldown(30)
      }
    } catch {
      setError('Kode baru belum berhasil dikirim. Coba lagi sebentar.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo-sijaka.png" alt="SIJAKA" className="auth-logo-img" />
        </div>
        <h2 className="auth-title">Verifikasi Email</h2>
        <p className="auth-subtitle">
          Masukkan kode OTP 6 digit yang dikirim ke<br />
          <strong>{email}</strong>
        </p>

        <form className="auth-form" onSubmit={handleVerify}>
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-success">{info}</div>}

          <div className="auth-input-group">
            <label>Kode OTP</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              style={{
                letterSpacing: '6px',
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: 700,
              }}
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading || otp.trim().length < 6}
          >
            {loading ? 'Memverifikasi...' : 'Verifikasi'}
          </button>
        </form>

        <div className="auth-footer">
          Tidak menerima kode?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              handleResend()
            }}
            style={
              cooldown > 0 || resending
                ? { pointerEvents: 'none', opacity: 0.5 }
                : undefined
            }
          >
            {resending
              ? 'Mengirim...'
              : cooldown > 0
              ? `Kirim ulang (${cooldown}s)`
              : 'Kirim ulang'}
          </a>
        </div>

        <div className="auth-footer">
          <Link to="/login">Kembali ke halaman masuk</Link>
        </div>
      </div>
    </div>
  )
}
