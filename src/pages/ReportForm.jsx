import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseclient'
import { useAuth } from '../context/useAuth'
import { useNavigate } from 'react-router-dom'
import { DAMAGE_TYPES } from '../lib/damageTypes'
import { enqueueReport, getQueuedReportCount, getQueuedReports, removeQueuedReport } from '../lib/reportQueue'
import { getAppSettings } from '../lib/appSettings'
import Navbar from '../components/Navbar'
import './ReportForm.css'

async function insertReport(payload) {
  let result = await supabase.from('reports').insert(payload)
  if (result.error?.message?.includes('reporter_avatar_url')) {
    const compatiblePayload = { ...payload }
    delete compatiblePayload.reporter_avatar_url
    result = await supabase.from('reports').insert(compatiblePayload)
  }
  return result
}

export default function ReportForm() {
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [damageType, setDamageType] = useState('')
  const [isDamageDrawerOpen, setIsDamageDrawerOpen] = useState(false)
  const [description, setDescription] = useState('')

  const damageOptions = Object.entries(DAMAGE_TYPES).map(([value, meta]) => ({ value, ...meta }))
  const [location, setLocation] = useState(null)
  const [locationAccuracy, setLocationAccuracy] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)
  const [success, setSuccess] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const locationWatchRef = useRef(null)
  const canvasRef = useRef(null)
  const damageSectionRef = useRef(null)
  const damageToggleRef = useRef(null)
  const descriptionSectionRef = useRef(null)
  const descriptionRef = useRef(null)
  const locationSectionRef = useRef(null)
  const mountedRef = useRef(true)
  const navigationTimerRef = useRef(null)

  const { user, fullName } = useAuth()
  const navigate = useNavigate()
  const selectedDamage = damageType ? DAMAGE_TYPES[damageType] : null

  const clearFieldError = (field) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const showFieldError = (field, message, targetRef, focusRef) => {
    setFieldErrors({ [field]: message })
    window.requestAnimationFrame(() => {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      focusRef?.current?.focus({ preventScroll: true })
    })
  }

  const flushQueuedReports = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return
    const queuedReports = getQueuedReports(user.id)
    for (const queuedReport of queuedReports) {
      const { queued_at: queuedAt, ...payload } = queuedReport
      const { error: queueError } = await insertReport(payload)
      if (queueError) break
      removeQueuedReport(queuedAt)
    }
    setQueuedCount(getQueuedReportCount(user.id))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return undefined
    setQueuedCount(getQueuedReportCount(user.id))
    const handleOnline = () => { flushQueuedReports() }
    window.addEventListener('online', handleOnline)
    flushQueuedReports()
    return () => window.removeEventListener('online', handleOnline)
  }, [flushQueuedReports, user?.id])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(navigationTimerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (locationWatchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchRef.current)
        locationWatchRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    getLocation()
  }, [])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch((err) => {
        console.error('Autoplay error:', err)
      })
    }
  }, [cameraActive])

  const startCamera = async () => {
    setCameraError('')
    setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera membutuhkan HTTPS dan browser yang mendukung akses kamera.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setCameraActive(true)
    } catch (err) {
      console.error('Kamera utama gagal, mencoba fallback:', err)
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
        if (!mountedRef.current) {
          fallbackStream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = fallbackStream
        setCameraActive(true)
      } catch (fallbackErr) {
        console.error('Fallback kamera gagal:', fallbackErr)
        setCameraError(
          'Tidak bisa mengakses kamera. Pastikan izin kamera sudah diberikan dan perangkat mendukung kamera.'
        )
        setCameraActive(false)
      }
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Gagal mengambil foto. Coba lagi.')
          return
        }
        if (blob.size > 8 * 1024 * 1024) {
          setError('Ukuran foto maksimal 8 MB. Coba ambil foto dengan resolusi lebih rendah.')
          return
        }
        const file = new File([blob], `foto-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        setPhoto(file)
        setPreview(URL.createObjectURL(blob))
        stopCamera()
      },
      'image/jpeg',
      0.9
    )
  }

  const retakePhoto = () => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }
    setPhoto(null)
    setPreview(null)
    startCamera()
  }

  function getLocation() {
    if (!getAppSettings().locationAccess) {
      setLocationStatus('error')
      setFieldErrors({ location: 'Akses lokasi sedang dimatikan. Aktifkan melalui Pengaturan Aplikasi untuk menandai lokasi laporan.' })
      return
    }
    setLocationStatus('loading')
    setError('')
    clearFieldError('location')

    if (!navigator.geolocation) {
      setFieldErrors({ location: 'Perangkat ini belum mendukung penentuan lokasi otomatis.' })
      setLocationStatus('error')
      return
    }
    if (!window.isSecureContext) {
      setFieldErrors({ location: 'Penentuan lokasi membutuhkan koneksi aman. Buka aplikasi melalui HTTPS.' })
      setLocationStatus('error')
      return
    }

    if (locationWatchRef.current != null) {
      navigator.geolocation.clearWatch(locationWatchRef.current)
    }

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!mountedRef.current) return
        if (locationWatchRef.current != null) {
          navigator.geolocation.clearWatch(locationWatchRef.current)
          locationWatchRef.current = null
        }
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        clearFieldError('location')
        setLocationAccuracy(position.coords.accuracy ?? null)
        setLocationStatus('success')
      },
      () => {
        if (!mountedRef.current) return
        setFieldErrors({ location: 'Lokasi belum ditemukan. Pastikan izin lokasi aktif, lalu coba lagi.' })
        setLocationStatus('error')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (!location) {
      showFieldError('location', 'Tentukan lokasi kejadian terlebih dahulu sebelum mengirim laporan.', locationSectionRef)
      return
    }
    if (!damageType) {
      showFieldError('damage', 'Pilih jenis kerusakan terlebih dahulu.', damageSectionRef, damageToggleRef)
      setIsDamageDrawerOpen(true)
      return
    }
    const trimmedDescription = description.trim()
    if (trimmedDescription.length < 10) {
      showFieldError('description', 'Deskripsi minimal 10 karakter agar laporan mudah ditindaklanjuti.', descriptionSectionRef, descriptionRef)
      return
    }
    if (!user?.id) {
      setError('Sesi Anda berakhir. Silakan masuk kembali sebelum mengirim laporan.')
      return
    }

    if (duplicateWarning && !duplicateConfirmed) {
      setError('Laporan dengan kategori dan lokasi yang sama ditemukan. Konfirmasi terlebih dahulu untuk melanjutkan.')
      return
    }

    setSubmitting(true)

    try {
      if (!navigator.onLine) {
        enqueueReport({
          user_id: user.id,
          reporter_name: fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Warga SIJAKA',
          reporter_avatar_url: user.user_metadata?.avatar_url || null,
          latitude: location.latitude,
          longitude: location.longitude,
          damage_type: damageType,
          description: trimmedDescription,
          status: 'Diterima',
        })
        setQueuedCount(getQueuedReportCount(user.id))
        setSuccess(true)
        setError('Koneksi sedang terputus. Laporan Anda disimpan dan akan dikirim saat koneksi kembali.')
        setSubmitting(false)
        return
      }

      if (!duplicateConfirmed) {
        const latitudeRange = 0.00045
        const longitudeRange = 0.00045
        const { data: nearbyReports, error: duplicateError } = await supabase
          .from('reports')
          .select('id, status, created_at')
          .eq('damage_type', damageType)
          .gte('latitude', location.latitude - latitudeRange)
          .lte('latitude', location.latitude + latitudeRange)
          .gte('longitude', location.longitude - longitudeRange)
          .lte('longitude', location.longitude + longitudeRange)
          .neq('status', 'Selesai')
          .limit(1)

        if (!duplicateError && nearbyReports?.length) {
          setDuplicateWarning(nearbyReports[0])
          setSubmitting(false)
          return
        }
      }

      let photoUrl = null

      if (photo) {
        const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.jpg`
        let uploadPhoto = photo

        if (photo.size > 1.5 * 1024 * 1024) {
          const bitmap = await createImageBitmap(photo)
          const maxSide = 1600
          const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(bitmap.width * scale)
          canvas.height = Math.round(bitmap.height * scale)
          canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
          const compressed = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
          if (compressed) uploadPhoto = new File([compressed], 'report.jpg', { type: 'image/jpeg' })
          bitmap.close()
        }
        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(fileName, uploadPhoto, { contentType: 'image/jpeg', upsert: false })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('report-photos')
          .getPublicUrl(fileName)

        photoUrl = urlData.publicUrl
      }

      const { error: insertError } = await insertReport({
        user_id: user.id,
        reporter_name: fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Warga SIJAKA',
        reporter_avatar_url: user.user_metadata?.avatar_url || null,
        ...(photoUrl ? { photo_url: photoUrl } : {}),
        latitude: location.latitude,
        longitude: location.longitude,
        damage_type: damageType,
        description: trimmedDescription,
        status: 'Diterima',
      })

      if (insertError) {
        if (photoUrl) {
          const filePath = photoUrl.split('/report-photos/')[1]
          if (filePath) await supabase.storage.from('report-photos').remove([filePath])
        }
        throw insertError
      }

      if (!mountedRef.current) return
      setSuccess(true)
      setDuplicateWarning(null)
      setDuplicateConfirmed(false)
      setError('')
    } catch {
      if (mountedRef.current) setError('Laporan Anda belum terkirim. Periksa koneksi lalu coba lagi.')
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }

  return (
    <div className="rf-page">
      <Navbar />

      <div className="rf-content">
        <section className="rf-hero">
          <div className="rf-hero-glow" aria-hidden="true" />
          <div className="rf-hero-copy">
            <span className="rf-kicker">LAPORAN ANDA</span>
            <h1>Kirim laporan kerusakan</h1>
            <p>Dokumentasikan kondisi jalan dengan foto, detail kerusakan, dan lokasi agar mudah ditindaklanjuti.</p>
          </div>
          <div className="rf-hero-icon" aria-hidden="true">
            <img src="/icons/lapor.svg" alt="" />
          </div>
        </section>

        {error && <div className="rf-alert rf-alert-error">{error}</div>}
        {duplicateWarning && !duplicateConfirmed && (
          <div className="rf-alert rf-alert-warning" role="alert">
            <strong>Laporan serupa ditemukan di sekitar lokasi ini.</strong>
            <span>Kategori ini sudah memiliki laporan di sekitar lokasi yang sama. Pastikan laporan Anda bukan duplikat.</span>
            <button type="button" onClick={() => { setDuplicateConfirmed(true); setError('') }}>
              Tetap kirim laporan
            </button>
          </div>
        )}
        {success && (
          <div className="rf-alert rf-alert-success">
            <div>{queuedCount > 0 ? 'Laporan Anda disimpan untuk dikirim nanti.' : 'Laporan Anda berhasil dikirim!'}</div>
          </div>
        )}
        {queuedCount > 0 && (
          <div className="rf-alert rf-alert-warning" role="status">
            {queuedCount} laporan menunggu koneksi untuk dikirim.
          </div>
        )}

        {success && createPortal(
          <div className="rf-success-backdrop" role="presentation">
            <section className="rf-success-dialog" role="dialog" aria-modal="true" aria-labelledby="report-success-title">
              <div className="rf-success-icon" aria-hidden="true">✓</div>
              <span className="rf-kicker">LAPORAN DITERIMA</span>
              <h2 id="report-success-title">Terima kasih, laporan Anda sudah masuk.</h2>
              <p>{queuedCount > 0 ? 'Laporan akan dikirim otomatis saat koneksi kembali.' : 'Laporan akan ditinjau dan ditindaklanjuti oleh tim SIJAKA.'}</p>
              <button type="button" className="rf-success-dashboard-btn" onClick={() => navigate('/dashboard')}>Ke Dashboard</button>
            </section>
          </div>,
          document.body,
        )}

        <form onSubmit={handleSubmit} className="rf-flow">
          {}
          <div className="rf-panel" ref={damageSectionRef}>
            <div className="rf-panel-head">
              <span className="rf-step-marker">1</span>
              <div className="rf-panel-head-copy">
                <h2>Bukti Foto</h2>
                <p>Foto membantu proses verifikasi. Anda juga dapat melewati langkah ini dan mengandalkan konfirmasi warga.</p>
              </div>
              {preview && <span className="rf-check" aria-hidden="true">✓</span>}
            </div>

            <div className="rf-panel-body">
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {!preview && !cameraActive && (
                <button type="button" className="rf-camera-cta" onClick={startCamera}>
                  <span className="rf-camera-cta-icon" aria-hidden="true"><img src="/icons/kamera.svg" alt="" /></span>
                  <span>
                    <strong>Buka Kamera</strong>
                    <small>Ketuk untuk mulai memotret</small>
                  </span>
                </button>
              )}

              {cameraError && <div className="rf-alert rf-alert-error">{cameraError}</div>}

              {cameraActive && (
                <div className="rf-camera-wrapper">
                  <video ref={videoRef} autoPlay playsInline muted className="rf-camera-preview" />
                  <div className="rf-camera-actions">
                    <button type="button" className="rf-capture-btn" onClick={capturePhoto}>
                      Ambil Foto
                    </button>
                    <button type="button" className="rf-cancel-btn" onClick={stopCamera}>
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {preview && (
                <div className="rf-preview-wrapper">
                  <img src={preview} alt="Preview foto kerusakan" className="rf-photo-preview" />
                  <button type="button" className="rf-retake-btn" onClick={retakePhoto}>
                    Ambil Ulang
                  </button>
                </div>
              )}
            </div>
          </div>

          {}
          <div className="rf-panel">
            <div className="rf-panel-head">
              <span className="rf-step-marker">2</span>
              <div className="rf-panel-head-copy">
                <h2>Kategori Kerusakan</h2>
                <p>Pilih kategori yang paling sesuai dengan kondisi jalan.</p>
              </div>
            </div>

            <div className="rf-panel-body">
              {fieldErrors.damage && <div className="rf-field-error" role="alert">{fieldErrors.damage}</div>}
              <button
                type="button"
                ref={damageToggleRef}
                className={`rf-damage-toggle ${isDamageDrawerOpen ? 'active' : ''} ${!selectedDamage ? 'placeholder' : ''}`}
                aria-invalid={Boolean(fieldErrors.damage)}
                aria-expanded={isDamageDrawerOpen}
                aria-controls="damage-options"
                onClick={() => setIsDamageDrawerOpen((previous) => !previous)}
              >
                <span className="rf-damage-toggle-icon">
                  {selectedDamage ? <img src={selectedDamage.icon} alt="" className="rf-damage-icon" /> : <span aria-hidden="true">+</span>}
                </span>
                <span className="rf-damage-toggle-copy">
                  <small>{selectedDamage ? 'Jenis terpilih' : 'Wajib diisi'}</small>
                  <strong>{selectedDamage?.label || 'Pilih jenis kerusakan'}</strong>
                </span>
                <span className="rf-damage-toggle-arrow" aria-hidden="true">{isDamageDrawerOpen ? '−' : '+'}</span>
              </button>

              {isDamageDrawerOpen && (
                <div className="rf-damage-grid" id="damage-options">
                  {damageOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`rf-damage-tile ${damageType === opt.value ? 'active' : ''}`}
                      onClick={() => {
                        setDamageType(opt.value)
                        clearFieldError('damage')
                        setDuplicateWarning(null)
                        setDuplicateConfirmed(false)
                        setIsDamageDrawerOpen(false)
                      }}
                    >
                      <span className="rf-damage-icon-wrap">
                        <img src={opt.icon} alt="" className="rf-damage-icon" />
                      </span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rf-panel" ref={descriptionSectionRef}>
            <div className="rf-panel-head">
              <span className="rf-step-marker">3</span>
              <div className="rf-panel-head-copy">
                <h2>Detail Kerusakan</h2>
                <p>Jelaskan patokan lokasi, ukuran, dan kondisi kerusakan agar mudah ditemukan.</p>
              </div>
            </div>

            <div className="rf-panel-body">
              <div className="rf-description-field">
                {fieldErrors.description && <div className="rf-field-error" role="alert">{fieldErrors.description}</div>}
                <textarea
                  id="report-description"
                  ref={descriptionRef}
                  value={description}
                  aria-invalid={Boolean(fieldErrors.description)}
                  onChange={(event) => { setDescription(event.target.value.slice(0, 500)); clearFieldError('description') }}
                  placeholder="Contoh: Lubang besar di depan halte, sekitar 1 meter, cukup mengganggu kendaraan saat malam."
                  maxLength={500}
                  rows={5}
                />
                <div className="rf-description-meta">
                  <span>Minimal 10 karakter</span>
                  <span>{description.length}/500</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rf-panel" ref={locationSectionRef}>
            <div className="rf-panel-head">
              <span className="rf-step-marker">4</span>
              <div className="rf-panel-head-copy">
                <h2>Lokasi Kerusakan</h2>
                <p>Kami akan menandai lokasi laporan secara otomatis.</p>
              </div>
              {locationStatus === 'success' && <span className="rf-check" aria-hidden="true">✓</span>}
            </div>

            <div className="rf-panel-body">
              {fieldErrors.location && <div className="rf-field-error" role="alert">{fieldErrors.location}</div>}
              {locationStatus === 'idle' && (
                <div className="rf-location-card">
                  <div className="rf-location-icon"><img src="/icons/peta.svg" alt="" /></div>
                  <div className="rf-location-text">
                    <strong>Siap mencari lokasi</strong>
                    <span>Izinkan akses lokasi agar laporan Anda tepat.</span>
                  </div>
                </div>
              )}

              {locationStatus === 'loading' && (
                <div className="rf-location-card loading">
                  <div className="rf-location-icon rf-location-loading" aria-hidden="true" />
                  <div className="rf-location-text">
                    <strong>Mencari lokasi…</strong>
                    <span>Sebentar, kami sedang menentukan titik laporan.</span>
                  </div>
                </div>
              )}

              {locationStatus === 'success' && location && (
                <div className="rf-location-card success">
                  <div className="rf-location-icon rf-location-success" aria-hidden="true">✓</div>
                  <div className="rf-location-text">
                    <strong>Lokasi laporan ditemukan</strong>
                    <span>
                      {locationAccuracy != null ? `Ketepatan sekitar ±${Math.round(locationAccuracy)} m` : 'Titik lokasi siap digunakan.'}
                    </span>
                  </div>
                </div>
              )}

              {locationStatus === 'error' && (
                <>
                  <div className="rf-location-card error">
                    <div className="rf-location-icon rf-location-error" aria-hidden="true">!</div>
                    <div className="rf-location-text">
                      <strong>Lokasi belum ditemukan</strong>
                      <span>Pastikan izin lokasi aktif, lalu coba lagi.</span>
                    </div>
                  </div>
                  <button type="button" className="rf-location-retry-btn" onClick={getLocation}>
                    <img src="/icons/peta.svg" alt="" /> Coba Tentukan Lokasi Lagi
                  </button>
                </>
              )}
            </div>
          </div>

          <button type="submit" className="rf-submit-btn" disabled={submitting}>
            {submitting ? 'Mengirim…' : 'Kirim Laporan Anda'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
    </div>
  )
}
