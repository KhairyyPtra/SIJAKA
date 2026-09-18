import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseclient'
import { normalizeEmail, validateEmail } from '../lib/validation'
import './Auth.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setSent(false)
    const normalizedEmail = normalizeEmail(email)
    const validationError = validateEmail(normalizedEmail)
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)

    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: `${appUrl.replace(/\/$/, '')}/reset-password` },
      )

      if (resetError) {
        console.error('Reset password error:', resetError)

        setError('Tautan pengaturan ulang belum dapat dikirim. Coba lagi sebentar.')
        setLoading(false)
        return
      }
      setSent(true)
    } catch (err) {
      console.error(err)
      setError('Permintaan belum dapat diproses. Coba lagi sebentar.')
    }

    setLoading(false)
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
          Lupa Password
        </h2>

        <p className="auth-subtitle">
          Masukkan email akun kamu, kami akan mengirim tautan
          untuk atur ulang password
        </p>

        {sent ? (
          <div className="auth-success">
            Jika email tersebut terdaftar, link reset password telah dikirim ke{' '}
            <strong>{email}</strong>.
            <br />
            Silakan cek email kamu, termasuk folder spam.
          </div>
        ) : (
          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >

            {}
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
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                required
              />
            </div>

            {}
            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading
                ? 'Memeriksa...'
                : 'Kirim Link Reset'}
            </button>

          </form>
        )}

        {}
        <div className="auth-footer">
          <Link to="/login">
            Kembali ke halaman masuk
          </Link>
        </div>

      </div>
    </div>
  )
}
