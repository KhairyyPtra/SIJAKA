import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseclient'
import { useAuth } from '../context/useAuth'
import { validateEmail, validatePassword } from '../lib/validation'
import { getAccountInitials } from '../lib/avatar'
import Navbar from '../components/Navbar'
import './Profile.css'

export default function Profile() {
  const { user, fullName, role, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(() => (user ? {
    full_name: fullName || user.user_metadata?.full_name || user.user_metadata?.name || '',
    email: user.email || '',
    role: role || (isAdmin ? 'admin' : 'user'),
    created_at: user.created_at || null,
  } : null))
  const [name, setName] = useState(fullName || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [emailStep, setEmailStep] = useState('input')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarMessage, setAvatarMessage] = useState('')
  const [avatarSourceOpen, setAvatarSourceOpen] = useState(false)
  const [avatarCameraOpen, setAvatarCameraOpen] = useState(false)
  const [avatarCameraError, setAvatarCameraError] = useState('')
  const [avatarCropSrc, setAvatarCropSrc] = useState('')
  const [avatarCropZoom, setAvatarCropZoom] = useState(1)
  const [avatarCropPosition, setAvatarCropPosition] = useState({ x: 0, y: 0 })
  const [avatarCropImageRatio, setAvatarCropImageRatio] = useState(1)
  const [avatarCropPreviewSize, setAvatarCropPreviewSize] = useState(320)
  const mountedRef = useRef(true)
  const avatarGalleryInputRef = useRef(null)
  const avatarCameraVideoRef = useRef(null)
  const avatarCameraStreamRef = useRef(null)
  const avatarCropPreviewRef = useRef(null)
  const avatarCropImageRef = useRef(null)
  const avatarCropDragRef = useRef(null)

  const openAvatarSource = () => {
    if (!avatarLoading) setAvatarSourceOpen(true)
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarError('')
    setAvatarMessage('')
    if (!file.type.startsWith('image/')) {
      setAvatarError('Foto profil harus berupa gambar.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Ukuran foto profil maksimal 5 MB.')
      return
    }

    const nextSrc = URL.createObjectURL(file)
    setAvatarCropSrc((previousSrc) => {
      if (previousSrc) URL.revokeObjectURL(previousSrc)
      return nextSrc
    })
    setAvatarCropZoom(1)
    setAvatarCropPosition({ x: 0, y: 0 })
    setAvatarCropImageRatio(1)
    setAvatarSourceOpen(false)
  }

  const stopAvatarCamera = () => {
    avatarCameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    avatarCameraStreamRef.current = null
    setAvatarCameraOpen(false)
  }

  const openAvatarCamera = async () => {
    setAvatarSourceOpen(false)
    setAvatarCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setAvatarCameraError('Kamera tidak tersedia di browser ini. Gunakan galeri untuk memilih foto.')
      setAvatarCameraOpen(true)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      avatarCameraStreamRef.current = stream
      setAvatarCameraOpen(true)
      requestAnimationFrame(() => {
        if (avatarCameraVideoRef.current) avatarCameraVideoRef.current.srcObject = stream
      })
    } catch (cameraError) {
      console.warn('Kamera profil:', cameraError)
      setAvatarCameraError('Kamera tidak dapat dibuka. Izinkan akses kamera atau gunakan galeri.')
      setAvatarCameraOpen(true)
    }
  }

  const captureAvatarPhoto = () => {
    const video = avatarCameraVideoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((photo) => {
      if (!photo) return
      const nextSrc = URL.createObjectURL(photo)
      setAvatarCropSrc((previousSrc) => {
        if (previousSrc) URL.revokeObjectURL(previousSrc)
        return nextSrc
      })
      setAvatarCropZoom(1)
      setAvatarCropPosition({ x: 0, y: 0 })
      stopAvatarCamera()
    }, 'image/jpeg', 0.9)
  }

  const closeAvatarCrop = () => {
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc)
    setAvatarCropSrc('')
    setAvatarCropZoom(1)
    setAvatarCropPosition({ x: 0, y: 0 })
    setAvatarCropImageRatio(1)
  }

  useEffect(() => {
    if (!avatarCropSrc) return undefined
    const updatePreviewSize = () => setAvatarCropPreviewSize(avatarCropPreviewRef.current?.clientWidth || 320)
    updatePreviewSize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePreviewSize) : null
    if (observer && avatarCropPreviewRef.current) observer.observe(avatarCropPreviewRef.current)
    return () => observer?.disconnect()
  }, [avatarCropSrc])

  const getCropDragLimits = (imageRatio = avatarCropImageRatio, previewSize = 320) => {
    const baseWidth = Math.max(previewSize, previewSize * imageRatio)
    const baseHeight = Math.max(previewSize, previewSize / imageRatio)
    return {
      x: Math.max(0, (baseWidth * avatarCropZoom - previewSize) / 2),
      y: Math.max(0, (baseHeight * avatarCropZoom - previewSize) / 2),
    }
  }

  const handleCropPointerDown = (event) => {
    if (avatarLoading) return
    event.currentTarget.setPointerCapture(event.pointerId)
    avatarCropDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, position: avatarCropPosition }
  }

  const handleCropPointerMove = (event) => {
    const drag = avatarCropDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const limits = getCropDragLimits(avatarCropImageRatio, avatarCropPreviewRef.current?.clientWidth || 320)
    const nextX = limits.x ? drag.position.x + (event.clientX - drag.startX) / limits.x : 0
    const nextY = limits.y ? drag.position.y + (event.clientY - drag.startY) / limits.y : 0
    setAvatarCropPosition({ x: Math.max(-1, Math.min(1, nextX)), y: Math.max(-1, Math.min(1, nextY)) })
  }

  const handleCropPointerUp = () => { avatarCropDragRef.current = null }

  const handleAvatarUpload = async () => {
    if (!avatarCropSrc) return

    setAvatarLoading(true)
    try {
      const image = new Image()
      image.src = avatarCropSrc
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
      })
      const cropSize = Math.min(image.naturalWidth, image.naturalHeight)
      const sourceSize = cropSize / avatarCropZoom
      const previewSize = avatarCropPreviewRef.current?.clientWidth || 320
      const displayedWidth = previewSize * image.naturalWidth / cropSize * avatarCropZoom
      const displayedHeight = previewSize * image.naturalHeight / cropSize * avatarCropZoom
      const offsetX = avatarCropPosition.x * Math.max(0, (displayedWidth - previewSize) / 2)
      const offsetY = avatarCropPosition.y * Math.max(0, (displayedHeight - previewSize) / 2)
      const sourceX = (image.naturalWidth - sourceSize) / 2 - (offsetX / displayedWidth) * image.naturalWidth
      const sourceY = (image.naturalHeight - sourceSize) / 2 - (offsetY / displayedHeight) * image.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      canvas.getContext('2d').drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512)
      const compressed = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84))
      if (!compressed) throw new Error('Foto tidak dapat diproses')

      const filePath = `${user.id}/profile-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(filePath, compressed, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('report-photos').getPublicUrl(filePath)
      const nextAvatarUrl = urlData.publicUrl
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { avatar_url: nextAvatarUrl },
      })
      if (metadataError) {
        await supabase.storage.from('report-photos').remove([filePath])
        throw metadataError
      }

      if (!mountedRef.current) return
      setAvatarUrl(nextAvatarUrl)
      setAvatarMessage('Foto profil berhasil diperbarui.')
      closeAvatarCrop()
    } catch (uploadError) {
      console.warn('Foto profil:', uploadError)
      if (mountedRef.current) setAvatarError('Foto profil belum dapat disimpan. Coba lagi.')
    } finally {
      if (mountedRef.current) setAvatarLoading(false)
    }
  }

  const cropPreviewSize = avatarCropPreviewSize
  const cropBaseWidth = Math.max(cropPreviewSize, cropPreviewSize * avatarCropImageRatio)
  const cropBaseHeight = Math.max(cropPreviewSize, cropPreviewSize / avatarCropImageRatio)
  const cropLimits = getCropDragLimits(avatarCropImageRatio, cropPreviewSize)
  const cropImageStyle = {
    width: `${cropBaseWidth * avatarCropZoom}px`,
    height: `${cropBaseHeight * avatarCropZoom}px`,
    transform: `translate(calc(-50% + ${avatarCropPosition.x * cropLimits.x}px), calc(-50% + ${avatarCropPosition.y * cropLimits.y}px))`,
  }

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setError('')

    try {
      const { data, error: pErr } = await supabase
        .from('profiles')
        .select('full_name, email, role, created_at')
        .eq('id', user.id)
        .maybeSingle()

      if (pErr) throw pErr
      if (!mountedRef.current) return

      const resolved = {
        full_name: data?.full_name || fullName || user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: data?.email || user.email || '',
        role: data?.role || role || (isAdmin ? 'admin' : 'user'),
        created_at: data?.created_at || user.created_at || null,
      }

      setProfile(resolved)
      setName(resolved.full_name)
    } catch (err) {
      if (mountedRef.current) setError('Informasi profil belum dapat dimuat. Coba lagi sebentar.')
      console.warn('profiles:', err)
    }
  }, [fullName, isAdmin, role, user])

  useEffect(() => {
    mountedRef.current = true
    if (!user) return undefined
    setProfile((prev) => prev || {
      full_name: fullName || user.user_metadata?.full_name || user.user_metadata?.name || '',
      email: user.email || '',
      role: role || (isAdmin ? 'admin' : 'user'),
      created_at: user.created_at || null,
    })
    fetchProfile()
    return () => { mountedRef.current = false }
  }, [fetchProfile, fullName, isAdmin, role, user])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setMessage('')
    setError('')

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Nama tidak boleh kosong')
      setSaving(false)
      return
    }
    const payload = {
      id: user.id,
      full_name: trimmed,
      email: user.email,
    }

    const { error: upErr } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })

    if (upErr) {
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ full_name: trimmed })
        .eq('id', user.id)

      setSaving(false)
      if (updErr) {
        setError('Perubahan nama belum tersimpan. Coba lagi sebentar.')
        return
      }
    } else {
      setSaving(false)
    }

    setMessage('Profil berhasil diperbarui')
    setProfile((prev) => ({ ...prev, full_name: trimmed }))
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const handleRequestEmailChange = async (e) => {
    e.preventDefault()
    setEmailError('')
    setEmailMessage('')

    const trimmed = newEmail.trim()
    const emailValidationError = validateEmail(trimmed)
    if (emailValidationError) {
      setEmailError(emailValidationError)
      return
    }
    if (trimmed === user?.email) {
      setEmailError('Email baru harus berbeda dari email saat ini')
      return
    }

    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    setEmailLoading(false)

    if (error) {
      setEmailError('Email belum dapat diperbarui. Pastikan alamat email benar, lalu coba lagi.')
    } else {
      setEmailStep('otp')
      setEmailMessage(`Kode OTP telah dikirim ke ${trimmed}. Masukkan kode untuk mengonfirmasi.`)
    }
  }

  const handleVerifyEmailChange = async (e) => {
    e.preventDefault()
    setEmailError('')

    setEmailLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email: newEmail.trim(),
      token: emailOtp.trim(),
      type: 'email_change',
    })
    setEmailLoading(false)

    if (error) {
      setEmailError('Kode konfirmasi belum diterima. Periksa kembali kode yang dimasukkan.')
    } else {
      setEmailMessage('Email berhasil diperbarui!')
      setEmailStep('input')
      setNewEmail('')
      setEmailOtp('')
      setProfile((prev) => ({ ...prev, email: user?.email }))
    }
  }

  const handleCancelEmailChange = () => {
    setEmailStep('input')
    setEmailOtp('')
    setEmailError('')
    setEmailMessage('')
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (!currentPassword) {
      setPasswordError('Masukkan password saat ini')
      return
    }
    const passwordValidationError = validatePassword(newPassword, 'Password baru')
    if (passwordValidationError) {
      setPasswordError(passwordValidationError)
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Konfirmasi password baru tidak cocok')
      return
    }

    setPasswordLoading(true)
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (reauthError) {
      setPasswordLoading(false)
      setPasswordError('Password saat ini salah')
      return
    }

    const { error: updErr } = await supabase.auth.updateUser({
      password: newPassword,
    })
    setPasswordLoading(false)

    if (updErr) {
      setPasswordError('Password baru belum dapat disimpan. Coba lagi sebentar.')
    } else {
      setPasswordMessage('Password berhasil diperbarui')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    }
  }

  const roleLabel = profile?.role === 'admin' || isAdmin
    ? 'Instansi'
    : profile?.role === 'community'
    ? 'Komunitas'
    : 'Warga'
  const roleClass =
    profile?.role === 'admin' || isAdmin ? 'pf-role-admin' : profile?.role === 'community' ? 'pf-role-community' : 'pf-role-user'
  const profileTitle = profile?.full_name || fullName || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Profil Warga'
  const profileDescription = profile?.role === 'admin' || isAdmin
    ? 'Kelola identitas dan keamanan akun untuk mengelola laporan jalan sebagai instansi.'
    : profile?.role === 'community'
      ? 'Kelola identitas dan keamanan akun untuk membantu penanganan jalan.'
      : 'Kelola informasi akun dan keamanan login Anda di sini.'
  const accountInitials = getAccountInitials(
    profile?.full_name || fullName || user?.user_metadata?.full_name || user?.user_metadata?.name,
    profile?.email || user?.email,
  )

  if (!user) {
    return (
      <div className="pf-page">
        <Navbar />
        <div className="pf-content">
          <section className="pf-hero">
            <div className="pf-hero-glow" aria-hidden="true" />
            <span className="pf-avatar pf-avatar-initials" aria-hidden="true">U</span>
            <div className="pf-hero-copy">
              <span className="pf-kicker">AKUN SAYA</span>
              <h1>User</h1>
              <p>Anda sedang menggunakan SIJAKA sebagai tamu.</p>
            </div>
            <span className="pf-role-badge pf-role-user">Guest</span>
          </section>

          <div className="pf-section-label">Pengaturan aplikasi</div>
          <Link to="/settings" className="pf-settings-link">Buka pengaturan aplikasi <span aria-hidden="true">→</span></Link>
          <div className="pf-panel pf-panel-actions">
            <div className="pf-panel-body">
              <button type="button" className="pf-save-btn" onClick={() => navigate('/login')}>
                Login untuk mengelola akun
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pf-page">
      <Navbar />

      <div className="pf-content">
        <section className="pf-hero">
          <div className="pf-hero-glow" aria-hidden="true" />
          <button type="button" className="pf-avatar-button" onClick={openAvatarSource} disabled={avatarLoading} aria-label="Ganti foto profil">
            {avatarUrl ? <img src={avatarUrl} alt="Profil pengguna" className="pf-avatar" /> : <span className="pf-avatar pf-avatar-initials" aria-hidden="true">{accountInitials}</span>}
            <span aria-hidden="true">{avatarLoading ? '...' : '✎'}</span>
          </button>
          <input ref={avatarGalleryInputRef} className="pf-avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} disabled={avatarLoading} />
          <div className="pf-hero-copy">
            <span className="pf-kicker">AKUN SAYA</span>
            <h1>{profileTitle}</h1>
            <p>{profileDescription}</p>
          </div>
          <span className={`pf-role-badge ${roleClass}`}>{roleLabel}</span>
        </section>

        <div className="pf-section-label">Pengaturan akun</div>

        <Link to="/settings" className="pf-settings-link">Buka pengaturan aplikasi <span aria-hidden="true">→</span></Link>

        {avatarMessage && <div className="pf-alert pf-alert-success">{avatarMessage}</div>}
        {avatarError && <div className="pf-alert pf-alert-error">{avatarError}</div>}

        {avatarSourceOpen && createPortal((
          <div className="pf-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAvatarSourceOpen(false)}>
            <section className="pf-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-source-title">
              <div className="pf-modal-head">
                <div><span className="pf-kicker">FOTO PROFIL</span><h2 id="avatar-source-title">Pilih sumber foto</h2></div>
                <button type="button" className="pf-modal-close" onClick={() => setAvatarSourceOpen(false)} aria-label="Tutup">×</button>
              </div>
              <div className="pf-source-options">
                <button type="button" className="pf-source-option" onClick={openAvatarCamera}><span className="pf-source-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.5" /></svg></span><strong>Buka kamera</strong><small>Ambil foto baru</small></button>
                <button type="button" className="pf-source-option" onClick={() => avatarGalleryInputRef.current?.click()}><span className="pf-source-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 4.5-4 3 2.5 2.5-2 6 5.5" /></svg></span><strong>Pilih dari galeri</strong><small>Gunakan foto tersimpan</small></button>
              </div>
            </section>
          </div>
        ), document.body)}

        {avatarCameraOpen && createPortal((
          <div className="pf-modal-backdrop" role="presentation">
            <section className="pf-modal pf-camera-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-camera-title">
              <div className="pf-modal-head"><div><span className="pf-kicker">FOTO PROFIL</span><h2 id="avatar-camera-title">Ambil foto</h2></div><button type="button" className="pf-modal-close" onClick={stopAvatarCamera} aria-label="Tutup">×</button></div>
              {avatarCameraError ? <div className="pf-camera-error">{avatarCameraError}</div> : <div className="pf-camera-preview"><video ref={avatarCameraVideoRef} autoPlay playsInline muted aria-label="Preview kamera" /></div>}
              <div className="pf-modal-actions"><button type="button" className="pf-logout-btn" onClick={stopAvatarCamera}>Batal</button>{!avatarCameraError && <button type="button" className="pf-save-btn" onClick={captureAvatarPhoto}>Ambil foto</button>}</div>
            </section>
          </div>
        ), document.body)}

        {avatarCropSrc && createPortal((
          <div className="pf-modal-backdrop" role="presentation">
            <section className="pf-modal pf-crop-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
              <div className="pf-modal-head">
                <div><span className="pf-kicker">PRATINJAU</span><h2 id="avatar-crop-title">Sesuaikan foto</h2></div>
                <button type="button" className="pf-modal-close" onClick={closeAvatarCrop} disabled={avatarLoading} aria-label="Tutup">×</button>
              </div>
              <div
                ref={avatarCropPreviewRef}
                className="pf-crop-preview"
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
              >
                <img
                  ref={avatarCropImageRef}
                  src={avatarCropSrc}
                  alt="Pratinjau foto profil"
                  draggable="false"
                  onLoad={(event) => setAvatarCropImageRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
                  style={cropImageStyle}
                />
                <span className="pf-crop-grid" aria-hidden="true"><i /><i /><i /><i /></span>
              </div>
              <label className="pf-crop-control" htmlFor="avatarCropZoom"><span>Perbesar / perkecil</span><output>{avatarCropZoom.toFixed(1)}×</output></label>
              <input id="avatarCropZoom" className="pf-crop-range" type="range" min="1" max="3" step="0.1" value={avatarCropZoom} onChange={(event) => setAvatarCropZoom(Number(event.target.value))} />
              <div className="pf-modal-actions"><button type="button" className="pf-logout-btn" onClick={closeAvatarCrop} disabled={avatarLoading}>Batal</button><button type="button" className="pf-save-btn" onClick={handleAvatarUpload} disabled={avatarLoading}>{avatarLoading ? 'Menyimpan...' : 'Gunakan foto ini'}</button></div>
            </section>
          </div>
        ), document.body)}

        <>
            <div className="pf-panel">
              <div className="pf-panel-head">
                <span className="pf-panel-marker info">●</span>
                <h2>Informasi Akun</h2>
              </div>
              <div className="pf-panel-body pf-info-list">
                <div className="pf-info-row">
                  <span className="pf-info-label">Email</span>
                  <span className="pf-info-value">
                    {profile?.email || user?.email || '—'}
                  </span>
                </div>

                <div className="pf-info-row">
                  <span className="pf-info-label">User ID</span>
                  <span className="pf-info-value mono">
                    {user?.id || '—'}
                  </span>
                </div>

                {profile?.created_at && (
                  <div className="pf-info-row">
                    <span className="pf-info-label">Terdaftar</span>
                    <span className="pf-info-value">
                      {new Date(profile.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <form className="pf-panel" onSubmit={handleSave}>
              <div className="pf-panel-head">
                <span className="pf-panel-marker name">●</span>
                <h2>Edit Nama</h2>
              </div>
              <div className="pf-panel-body">
                {message && <div className="pf-alert pf-alert-success">{message}</div>}
                {error && <div className="pf-alert pf-alert-error">{error}</div>}

                <div className="pf-field">
                  <label htmlFor="fullName">Nama lengkap</label>
                  <input
                    id="fullName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama lengkap"
                    required
                  />
                </div>

                <button type="submit" className="pf-save-btn" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan perubahan'}
                </button>
              </div>
            </form>

            <form className="pf-panel" onSubmit={emailStep === 'input' ? handleRequestEmailChange : handleVerifyEmailChange}>
              <div className="pf-panel-head">
                <span className="pf-panel-marker email">●</span>
                <h2>Ganti Email</h2>
              </div>
              <div className="pf-panel-body">
                {emailMessage && <div className="pf-alert pf-alert-success">{emailMessage}</div>}
                {emailError && <div className="pf-alert pf-alert-error">{emailError}</div>}

                {emailStep === 'input' ? (
                  <div className="pf-field">
                    <label htmlFor="newEmail">Email baru</label>
                    <input
                      id="newEmail"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="email-baru@contoh.com"
                      required
                    />
                  </div>
                ) : (
                  <div className="pf-field">
                    <label htmlFor="emailOtp">Kode OTP</label>
                    <input
                      id="emailOtp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      required
                      style={{ letterSpacing: '6px', textAlign: 'center', fontWeight: 700 }}
                    />
                  </div>
                )}

                <button type="submit" className="pf-save-btn" disabled={emailLoading}>
                  {emailLoading
                    ? 'Memproses...'
                    : emailStep === 'input'
                    ? 'Kirim OTP ke email baru'
                    : 'Verifikasi & Simpan Email'}
                </button>

                {emailStep === 'otp' && (
                  <button
                    type="button"
                    className="pf-logout-btn"
                    style={{ marginTop: '10px' }}
                    onClick={handleCancelEmailChange}
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            <form className="pf-panel" onSubmit={handleChangePassword}>
              <div className="pf-panel-head">
                <span className="pf-panel-marker password">●</span>
                <h2>Ganti Password</h2>
              </div>
              <div className="pf-panel-body">
                {passwordMessage && <div className="pf-alert pf-alert-success">{passwordMessage}</div>}
                {passwordError && <div className="pf-alert pf-alert-error">{passwordError}</div>}

                <div className="pf-field">
                  <label htmlFor="currentPassword">Password saat ini</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="pf-field">
                  <label htmlFor="newPassword">Password baru</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    minLength={6}
                    required
                  />
                </div>

                <div className="pf-field">
                  <label htmlFor="confirmNewPassword">Konfirmasi password baru</label>
                  <input
                    id="confirmNewPassword"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    minLength={6}
                    required
                  />
                </div>

                <button type="submit" className="pf-save-btn" disabled={passwordLoading}>
                  {passwordLoading ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </div>
            </form>

            <div className="pf-panel pf-panel-actions">
              <div className="pf-panel-body">
                <button
                  type="button"
                  className="pf-logout-btn"
                  onClick={handleLogout}
                >
                  Keluar dari akun
                </button>
              </div>
            </div>
        </>
      </div>
    </div>
  )
}
