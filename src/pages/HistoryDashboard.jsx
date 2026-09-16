import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { DAMAGE_TYPES } from '../lib/damageTypes'
import { supabase } from '../lib/supabaseclient'
import Navbar from '../components/Navbar'
import './HistoryDashboard.css'

const STATUS_FLOW = ['Diterima', 'Diverifikasi', 'Proses', 'Selesai']

const statusColors = {
  Diterima: '#94a3b8',
  Diverifikasi: '#3b82f6',
  Proses: '#f59e0b',
  Selesai: '#22c55e',
}

function formatDate(value) {
  if (!value) return 'Belum ada tanggal'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Belum ada tanggal'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return 'Belum ada waktu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Belum ada waktu'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getReporterLabel(report) {
  if (report.reporter_name) return report.reporter_name
  if (report.reporter_email) return report.reporter_email
  if (report.user_id) return `User ${String(report.user_id).slice(0, 8)}…`
  return 'Pelapor tidak tercatat'
}

export default function HistoryDashboard() {
  const { user, role, loading: authLoading } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')

  const isStaff = role === 'admin' || role === 'community'

  const fetchReports = async () => {
    if (!user && !isStaff) {
      setReports([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isStaff && user?.id) {
        query = query.eq('user_id', user.id)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError
      setReports(data || [])
    } catch (fetchError) {
      console.error('Gagal memuat riwayat laporan:', fetchError)
      setError('Riwayat laporan belum dapat dimuat. Coba lagi sebentar.')
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      fetchReports()
    }
  }, [authLoading, user?.id, role])

  useEffect(() => {
    if (authLoading || (!user && !isStaff)) return undefined

    const channel = supabase
      .channel(`history-reports-${user?.id || role || 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => fetchReports()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [authLoading, user?.id, role])

  const filteredReports = useMemo(() => {
    if (statusFilter === 'semua') return reports
    return reports.filter((report) => report.status === statusFilter)
  }, [reports, statusFilter])

  const stats = useMemo(() => ({
    total: reports.length,
    diterima: reports.filter((report) => report.status === 'Diterima').length,
    diverifikasi: reports.filter((report) => report.status === 'Diverifikasi').length,
    proses: reports.filter((report) => report.status === 'Proses').length,
    selesai: reports.filter((report) => report.status === 'Selesai').length,
  }), [reports])

  const heroTitle = isStaff ? 'Riwayat Laporan' : 'Riwayat Laporan Saya'
  const heroText = isStaff
    ? 'Semua laporan yang pernah masuk, diperiksa, ditangani, dan diselesaikan dapat ditinjau di satu tempat.'
    : 'Pantau semua laporan yang pernah Anda kirim dan lihat perjalanan statusnya dari awal hingga selesai.'

  if (authLoading) {
    return (
      <div className="history-page">
        <Navbar />
        <main className="history-content">
          <div className="history-state">Memuat riwayat...</div>
        </main>
      </div>
    )
  }

  return (
    <div className={`history-page ${isStaff ? 'history-staff' : ''}`}>
      <Navbar />
      <main className="history-content">
        <section className="history-hero">
          <div>
            <span className="history-kicker">RIWAYAT</span>
            <h1>{heroTitle}</h1>
            <p>{heroText}</p>
          </div>
          <img src="/icons/laporan.svg" alt="" aria-hidden="true" />
        </section>

        {error && (
          <div className="history-alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={fetchReports}>Coba lagi</button>
          </div>
        )}

        {!user && !isStaff ? (
          <div className="history-empty">
            <h2>Masuk untuk melihat riwayat</h2>
            <p>Riwayat laporan akan muncul di sini setelah Anda masuk ke akun.</p>
            <Link to="/login" className="history-primary">Masuk</Link>
          </div>
        ) : (
          <>
            <div className="history-stats-strip">
              <div className="history-stat">
                <strong>{stats.total}</strong>
                <span>Total</span>
              </div>
              <div className="history-stat" style={{ '--history-dot-color': statusColors.Diterima }}>
                <strong>{stats.diterima}</strong>
                <span>Diterima</span>
              </div>
              <div className="history-stat" style={{ '--history-dot-color': statusColors.Diverifikasi }}>
                <strong>{stats.diverifikasi}</strong>
                <span>Verifikasi</span>
              </div>
              <div className="history-stat" style={{ '--history-dot-color': statusColors.Proses }}>
                <strong>{stats.proses}</strong>
                <span>Proses</span>
              </div>
              <div className="history-stat" style={{ '--history-dot-color': statusColors.Selesai }}>
                <strong>{stats.selesai}</strong>
                <span>Selesai</span>
              </div>
            </div>

            <div className="history-filter-panel">
              <span className="history-filter-label">Status</span>
              <div className="history-filter-group">
                {['semua', ...STATUS_FLOW].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={statusFilter === value ? 'active' : ''}
                    onClick={() => setStatusFilter(value)}
                    aria-pressed={statusFilter === value}
                  >
                    {value === 'semua' ? 'Semua' : value}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="history-state">Memuat data riwayat...</div>
            ) : filteredReports.length === 0 ? (
              <div className="history-empty">
                <h2>Belum ada riwayat</h2>
                <p>{isStaff ? 'Belum ada laporan yang cocok dengan filter saat ini.' : 'Laporan yang Anda kirim akan muncul di sini.'}</p>
                {!isStaff && <Link to="/report" className="history-primary">Buat laporan</Link>}
              </div>
            ) : (
              <section className="history-list" aria-label="Riwayat laporan">
                {filteredReports.map((report) => {
                  const meta = DAMAGE_TYPES[report.damage_type] || { label: 'Kerusakan jalan', icon: '/icons/lapor.svg' }
                  const reporterLabel = getReporterLabel(report)
                  const hasCoordinates = Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude))

                  return (
                    <article className="history-card" key={report.id}>
                      <div className="history-card-icon">
                        <img src={meta.icon} alt="" aria-hidden="true" />
                      </div>

                      <div className="history-card-body">
                        <div className="history-card-top">
                          <div>
                            <span className="history-card-type">{meta.label}</span>
                            <h3>{report.description || 'Deskripsi laporan tidak tersedia'}</h3>
                          </div>
                          <span className="history-status-badge" style={{ background: statusColors[report.status] || '#94a3b8' }}>
                            {report.status || 'Diterima'}
                          </span>
                        </div>

                        <div className="history-meta-list">
                          <span><strong>Pelapor:</strong> {isStaff ? reporterLabel : 'Anda'}</span>
                          <span><strong>Waktu:</strong> {formatDateTime(report.created_at)}</span>
                          <span><strong>Update:</strong> {formatDate(report.updated_at || report.created_at)}</span>
                        </div>

                        <div className="history-detail-grid">
                          <div>
                            <span>Verifikasi</span>
                            <strong>{report.verified_by_name || 'Belum diverifikasi'}</strong>
                          </div>
                          <div>
                            <span>Penanganan</span>
                            <strong>{report.repairer_name || 'Belum ditangani'}</strong>
                          </div>
                          <div>
                            <span>Koordinat</span>
                            <strong>{hasCoordinates ? `${Number(report.latitude).toFixed(6)}, ${Number(report.longitude).toFixed(6)}` : 'Tidak tersedia'}</strong>
                          </div>
                          <div>
                            <span>Selesai</span>
                            <strong>{report.completed_at ? formatDateTime(report.completed_at) : 'Belum selesai'}</strong>
                          </div>
                        </div>

                        {report.hidden_from_map && (
                          <div className="history-note">
                            <strong>Disembunyikan dari peta</strong>
                            <span>{report.hidden_reason || 'Alasan tidak tersedia.'}</span>
                          </div>
                        )}
                      </div>

                      <div className="history-card-actions">
                        {hasCoordinates && (
                          <Link className="history-map-button" to={`/map?id=${encodeURIComponent(report.id)}`} aria-label={`Lihat laporan ${meta.label} di peta`}>
                            <img src="/icons/peta.svg" alt="" aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                    </article>
                  )
                })}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
