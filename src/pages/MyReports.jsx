import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseclient'
import { useAuth } from '../context/useAuth'
import { DAMAGE_TYPES } from '../lib/damageTypes'
import { getAppSettings } from '../lib/appSettings'
import Navbar from '../components/Navbar'
import './MyReports.css'

const statusColors = {
  Diterima: '#94a3b8',
  Diverifikasi: '#3b82f6',
  Proses: '#f59e0b',
  Selesai: '#22c55e',
}

function isReportLocked(report) {
  return Boolean(
    report.verified_by_role ||
    report.verified_at ||
    (report.status && report.status !== 'Diterima')
  )
}

function formatDate(value) {
  if (!value) return 'Tanggal tidak tersedia'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getStatusExplanation(status) {
  switch (status || 'Diterima') {
    case 'Diterima':
      return 'Laporan sudah diterima dan masuk ke sistem. Menunggu validasi atau penanganan lanjutan.'
    case 'Diverifikasi':
      return 'Laporan sudah diverifikasi dan siap ditindaklanjuti oleh tim terkait.'
    case 'Proses':
      return 'Laporan sedang dalam proses penanganan atau perbaikan di lapangan.'
    case 'Selesai':
      return 'Laporan sudah selesai dan dibuktikan dengan foto penyelesaian.'
    default:
      return 'Status laporan sedang diperbarui.'
  }
}

export default function MyReports() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusNotice, setStatusNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [voteCounts, setVoteCounts] = useState({})
  const [confirmDeleteReport, setConfirmDeleteReport] = useState(null)

  const fetchReports = useCallback(async () => {
    if (!userId) {
      setReports([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')

    const { data, error: queryError } = await supabase
      .from('reports')
      .select('id, damage_type, description, status, created_at, latitude, longitude, photo_url, verified_by_name, verified_by_role, verified_at, repairer_name, repairer_role, repair_started_at, completion_photo_url, completed_at, hidden_from_map, hidden_at, hidden_reason')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (queryError) {
      console.warn('Laporan saya:', queryError)
      setError('Laporan belum dapat dimuat. Coba lagi.')
      setReports([])
    } else {
      setReports(data || [])
      const reportIds = (data || []).map((report) => report.id)
      if (reportIds.length) {
        const { data: votes } = await supabase
          .from('report_votes')
          .select('report_id')
          .in('report_id', reportIds)
        setVoteCounts((votes || []).reduce((counts, vote) => {
          counts[vote.report_id] = (counts[vote.report_id] || 0) + 1
          return counts
        }, {}))
      } else {
        setVoteCounts({})
      }
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchReports()
    if (!getAppSettings().notifications) return undefined
    const channel = supabase
      .channel(`my-reports-${userId || 'guest'}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reports', filter: userId ? `user_id=eq.${userId}` : undefined },
        (payload) => {
          const previousStatus = payload.old?.status
          const nextStatus = payload.new?.status
          if (!nextStatus || previousStatus === nextStatus) return
          const statusMessage = `Status laporan Anda berubah menjadi ${nextStatus}.`
          setStatusNotice(statusMessage)
          window.dispatchEvent(new CustomEvent('sijaka:notification', {
            detail: { title: 'Pembaruan laporan', message: statusMessage },
          }))
          setReports((current) => current.map((report) => (
            report.id === payload.new.id ? { ...report, status: nextStatus } : report
          )))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchReports, userId])

  const handleDelete = async (report) => {
    if (!userId) {
      setError('Sesi Anda berakhir. Silakan masuk kembali sebelum menghapus laporan.')
      return
    }
    if (isReportLocked(report)) {
      setError('Laporan yang sudah diverifikasi instansi atau komunitas tidak dapat dihapus.')
      return
    }
    if (deletingId) return

    setDeletingId(report.id)
    setConfirmDeleteReport(null)
    setError('')
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .eq('id', report.id)
      .eq('user_id', userId)

    if (deleteError) {
      console.warn('Hapus laporan:', deleteError)
      setError('Laporan belum dapat dihapus saat ini. Coba lagi beberapa saat nanti.')
      setDeletingId(null)
      return
    }

    const { data: remainingReport, error: verifyError } = await supabase
      .from('reports')
      .select('id')
      .eq('id', report.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (verifyError || remainingReport) {
      setError('Laporan belum terhapus. Muat ulang halaman lalu coba lagi.')
      setDeletingId(null)
      return
    }

    if (report.photo_url) {
      const marker = '/report-photos/'
      const filePath = report.photo_url.split(marker)[1]
      if (filePath) {
        const { error: photoError } = await supabase.storage.from('report-photos').remove([decodeURIComponent(filePath)])
        if (photoError) console.warn('Foto laporan tidak ikut terhapus:', photoError)
      }
    }

    setReports((current) => current.filter((item) => item.id !== report.id))
    setStatusNotice('Laporan berhasil dihapus.')
    setDeletingId(null)
  }

  return (
    <div className="my-reports-page">
      <Navbar />
      <main className="my-reports-content">
        <section className="my-reports-hero">
          <div>
            <span className="my-reports-kicker">RIWAYAT PELAPORAN</span>
            <h1>Laporan Saya</h1>
            <p>Pantau laporan yang pernah Anda kirim dan lihat titiknya di peta.</p>
          </div>
            <img src="/icons/laporan.svg" alt="" aria-hidden="true" />
        </section>

        {error && (
          <div className="my-reports-alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={fetchReports}>Coba lagi</button>
          </div>
        )}
        {statusNotice && (
          <div className="my-reports-alert" role="status">
            <span>{statusNotice}</span>
            <button type="button" onClick={() => setStatusNotice('')}>Tutup</button>
          </div>
        )}

        {(authLoading || loading) && <div className="my-reports-state">Memuat laporan...</div>}
        {!authLoading && !user && !loading && (
          <div className="my-reports-empty">
            <h2>Masuk untuk melihat laporan</h2>
            <p>Halaman ini hanya menampilkan laporan yang dikirim oleh akun Anda.</p>
            <Link to="/login" className="my-reports-primary">Masuk</Link>
          </div>
        )}
        {!authLoading && user && !loading && !error && reports.length === 0 && (
          <div className="my-reports-empty">
            <img src="/icons/lapor.svg" alt="" aria-hidden="true" />
            <h2>Belum ada laporan</h2>
            <p>Laporan yang Anda kirim akan muncul di halaman ini.</p>
            <Link to="/report" className="my-reports-primary">Buat laporan</Link>
          </div>
        )}

        {!authLoading && user && !loading && reports.length > 0 && (
          <section className="my-reports-list" aria-label="Daftar laporan saya">
            <div className="my-reports-list-heading">
              <h2>{reports.length} Laporan</h2>
              <div className="my-reports-actions">
                <Link to="/history" className="my-reports-secondary my-reports-history-link">Riwayat</Link>
                <Link to="/report" className="my-reports-secondary my-reports-new-link">+ Laporan baru</Link>
              </div>
            </div>
            {reports.map((report) => {
              const meta = DAMAGE_TYPES[report.damage_type] || { label: 'Kerusakan jalan', icon: '/icons/lapor.svg' }
              const hasLocation = Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude))
              const isExpanded = expandedId === report.id
              const isDeleteLocked = isReportLocked(report)
              const roleLabel = (role) => role === 'community' ? 'Komunitas' : role === 'admin' ? 'Instansi' : ''
              return (
                <article className="my-report-card" key={report.id}>
                  <div className="my-report-icon"><img src={meta.icon} alt="" /></div>
                  <div className="my-report-main">
                    <div className="my-report-title-row">
                      <h3>{meta.label}</h3>
                      <span className="my-report-status" style={{ '--status-color': statusColors[report.status] || '#94a3b8' }}>{report.status || 'Diterima'}</span>
                    </div>
                    <p>{report.description || 'Tanpa deskripsi'}</p>
                    {report.hidden_from_map && (
                      <div className="my-report-hidden-note">
                        <strong>Disembunyikan dari peta</strong>
                        <span>{report.hidden_reason || 'Alasan tidak tersedia.'}</span>
                      </div>
                    )}
                    <small>{formatDate(report.created_at)}</small>
                    <div className="my-report-status-note">{getStatusExplanation(report.status || 'Diterima')}</div>
                    <button
                      type="button"
                      className="my-report-detail-toggle"
                      onClick={() => setExpandedId((current) => current === report.id ? null : report.id)}
                    >
                      {isExpanded ? 'Sembunyikan detail' : 'Lihat detail laporan'}
                    </button>
                    {isExpanded && (
                      <div className="my-report-detail">
                        <div><span>Verifikasi</span><strong>{report.verified_by_name ? `${report.verified_by_name}${roleLabel(report.verified_by_role) ? ` · ${roleLabel(report.verified_by_role)}` : ''}` : 'Belum diverifikasi'}</strong></div>
                        <div><span>Penanganan</span><strong>{report.repairer_name ? `${report.repairer_name}${roleLabel(report.repairer_role) ? ` · ${roleLabel(report.repairer_role)}` : ''}` : 'Belum ditangani'}</strong></div>
                        <div><span>Konfirmasi warga</span><strong>{voteCounts[report.id] || 0}</strong></div>
                        <div><span>Koordinat</span><strong>{hasLocation ? `${Number(report.latitude).toFixed(6)}, ${Number(report.longitude).toFixed(6)}` : 'Tidak tersedia'}</strong></div>
                        <div><span>Waktu dilaporkan</span><strong>{new Date(report.created_at).toLocaleString('id-ID')}</strong></div>
                        {report.completed_at && <div><span>Selesai pada</span><strong>{new Date(report.completed_at).toLocaleString('id-ID')}</strong></div>}
                        {report.completion_photo_url && <img src={report.completion_photo_url} alt="Bukti penyelesaian laporan" />}
                      </div>
                    )}
                  </div>
                  <div className="my-report-actions">
                    {hasLocation && (
                      <Link className="my-report-map-link" to={`/map?id=${encodeURIComponent(report.id)}`} aria-label={`Lihat ${meta.label} di peta`}>
                        <img src="/icons/peta.svg" alt="" />
                      </Link>
                    )}
                    <button
                      type="button"
                      className="my-report-delete-button"
                      onClick={() => setConfirmDeleteReport(report)}
                      disabled={deletingId === report.id || isDeleteLocked}
                      title={isDeleteLocked ? 'Laporan yang sudah diverifikasi tidak dapat dihapus' : 'Hapus laporan'}
                      aria-label={`Hapus ${meta.label}`}
                    >
                      {deletingId === report.id ? '...' : isDeleteLocked ? 'Terkunci' : 'Hapus'}
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>

      {confirmDeleteReport && (
        <div className="my-report-confirm-backdrop" role="presentation">
          <section className="my-report-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-report-title">
            <div className="my-report-confirm-icon" aria-hidden="true">!</div>
            <h2 id="delete-report-title">Hapus laporan?</h2>
            <p>Laporan <strong>{DAMAGE_TYPES[confirmDeleteReport.damage_type]?.label || 'kerusakan jalan'}</strong> akan dihapus permanen dan tidak dapat dipulihkan.</p>
            <div className="my-report-confirm-actions">
              <button type="button" className="my-report-confirm-cancel" onClick={() => setConfirmDeleteReport(null)}>Batal</button>
              <button type="button" className="my-report-confirm-delete" onClick={() => handleDelete(confirmDeleteReport)}>Hapus laporan</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
