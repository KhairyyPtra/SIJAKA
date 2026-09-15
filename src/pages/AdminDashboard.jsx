import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPriorityScore, getReportInsight } from '../lib/aiInsights'
import { DAMAGE_TYPES } from '../lib/damageTypes'
import { supabase } from '../lib/supabaseclient'
import { useAuth } from '../context/useAuth'
import { isValidCoordinate } from '../lib/validation'
import Navbar from '../components/Navbar'
import './AdminDashboard.css'

const STATUS_FLOW = ['Diterima', 'Diverifikasi', 'Proses', 'Selesai']

const damageMeta = DAMAGE_TYPES

const statusColors = {
  Diterima: '#94a3b8',
  Diverifikasi: '#3b82f6',
  Proses: '#f59e0b',
  Selesai: '#22c55e',
}

const MS_DAY = 24 * 60 * 60 * 1000
const RETENTION_SELESAI = 7 * MS_DAY
const RETENTION_ACTIVE = 60 * MS_DAY

function isWithinRetention(report) {
  const created = new Date(report.created_at).getTime()
  if (Number.isNaN(created)) return true
  const age = Date.now() - created
  if (report.status === 'Selesai') return age < RETENTION_SELESAI
  return age < RETENTION_ACTIVE
}

function formatCoordinate(value) {
  const coordinate = Number(value)
  return Number.isFinite(coordinate) ? coordinate.toFixed(6) : '—'
}

function pickReporter(report, profileMap = {}) {
  const p = profileMap[report.user_id] || {}

  const name = (
    report.reporter_name ||
    p.full_name ||
    ''
  )
    .toString()
    .trim()

  const email = (report.reporter_email || p.email || '').toString().trim()

  if (name && email) return { name, email, label: `${name} · ${email}` }
  if (name) return { name, email: email || null, label: name }
  if (email) return { name: email.split('@')[0], email, label: email }
  if (report.user_id) {
    return {
      name: null,
      email: null,
      label: `User ${String(report.user_id).slice(0, 8)}…`,
    }
  }
  return { name: null, email: null, label: 'Pelapor tidak tercatat' }
}

export default function AdminDashboard() {
  const { user, role, fullName } = useAuth()
  const [reports, setReports] = useState([])
  const [voteCounts, setVoteCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('semua')
  const [damageFilter, setDamageFilter] = useState('semua')
  const [updatingId, setUpdatingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [fetchNote, setFetchNote] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const navigate = useNavigate()
  const [completingId, setCompletingId] = useState(null)
  const [completionFile, setCompletionFile] = useState(null)
  const [completionPreview, setCompletionPreview] = useState(null)
  const [completionError, setCompletionError] = useState('')
  const [completionSubmitting, setCompletionSubmitting] = useState(false)
  const [deleteReport, setDeleteReport] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const completionFlowActive = useRef(false)

  const fetchReports = async () => {
    setLoading(true)
    setFetchNote('')
    setActionError('')
    setActionNotice('')

    try {
      const { data: reportData, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (error || !reportData) {
        throw error || new Error('Data laporan kosong')
      }

      const visible = reportData.filter((report) => isWithinRetention(report) && !report.hidden_from_map)
      const { data: voteRows, error: voteError } = await supabase
        .from('report_votes')
        .select('report_id, user_id')

      let confirmations = {}
      let voteUserIds = []
      if (voteError) {
        console.warn('Vote laporan belum tersedia:', voteError.message)
      } else {
        const counts = {}
        confirmations = {}
        ;(voteRows || []).forEach((vote) => {
          if (!vote?.report_id) return
          counts[vote.report_id] = (counts[vote.report_id] || 0) + 1
          if (!confirmations[vote.report_id]) confirmations[vote.report_id] = []
          confirmations[vote.report_id].push(vote.user_id)
        })
        setVoteCounts(counts)
        voteUserIds = voteRows.map((vote) => vote.user_id).filter(Boolean)
      }

      const userIds = [...new Set([
        ...visible.map((r) => r.user_id),
        ...visible.map((r) => r.verified_by),
        ...visible.map((r) => r.repairer_id),
        ...voteUserIds,
      ].filter(Boolean))]
      let profileMap = {}

      if (userIds.length > 0) {
        const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', userIds)

        if (!pErr && profiles) {
          profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
        } else if (pErr) {
          console.warn('Gagal baca profiles (cek RLS admin):', pErr.message)
          setFetchNote(
            'Sebagian informasi pelapor belum tersedia. Coba muat ulang panel untuk melihat data terbaru.'
          )
        }
      }

      const enriched = visible.map((r) => {
        const reporter = pickReporter(r, profileMap)
        return {
          ...r,
          confirmationVoters: (confirmations[r.id] || []).map((userId) => pickReporter({ user_id: userId }, profileMap)),
          verified_by_name: r.verified_by_name || (r.verified_by ? pickReporter({ user_id: r.verified_by }, profileMap).label : null),
          repairer_name: r.repairer_name || (r.repairer_id ? pickReporter({ user_id: r.repairer_id }, profileMap).label : null),
          reporter,
          reporter_name: r.reporter_name || reporter.name || null,
          reporter_email: r.reporter_email || reporter.email || null,
        }
      })

      setReports(enriched)
    } catch (error) {
      console.error('Gagal ambil laporan:', error?.message || error)
      setActionError(role === 'community'
        ? 'Temuan warga belum dapat dimuat. Periksa koneksi lalu coba lagi.'
        : 'Laporan warga belum dapat dimuat. Periksa koneksi lalu coba lagi.')
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()

    const refreshTimer = window.setInterval(() => {
      if (!completionFlowActive.current) fetchReports()
    }, 15000)
    const refreshWhenActive = () => {
      if (!document.hidden && !completionFlowActive.current) fetchReports()
    }
    const refreshWhenOnline = () => {
      if (!completionFlowActive.current) fetchReports()
    }
    document.addEventListener('visibilitychange', refreshWhenActive)
    window.addEventListener('focus', refreshWhenActive)
    window.addEventListener('online', refreshWhenOnline)
    const reportsChannel = supabase
      .channel('admin-reports-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => fetchReports()
      )
      .subscribe()

    return () => {
      window.clearInterval(refreshTimer)
      completionFlowActive.current = false
      document.removeEventListener('visibilitychange', refreshWhenActive)
      window.removeEventListener('focus', refreshWhenActive)
      window.removeEventListener('online', refreshWhenOnline)
      supabase.removeChannel(reportsChannel)
    }
  }, [])

  useEffect(() => () => {
    if (completionPreview) URL.revokeObjectURL(completionPreview)
  }, [completionPreview])

  const updateStatus = async (id, newStatus) => {
    const current = reports.find((r) => r.id === id)
    if (current?.status === 'Selesai') return

    if (newStatus === 'Diverifikasi' && current?.status !== 'Diterima') {
      setActionError('Laporan ini sudah diverifikasi oleh pihak lain.')
      return
    }

    if (
      newStatus === 'Proses' &&
      role === 'community' &&
      current?.verified_by_role === 'community' &&
      current?.verified_by !== user?.id
    ) {
      setActionError('Laporan ini sudah diverifikasi komunitas lain dan tidak dapat Anda klaim.')
      return
    }

    if (newStatus === 'Proses' && role === 'community') {
      const activeAssignments = reports.filter((report) => (
        report.status === 'Proses' && report.repairer_id === user?.id
      )).length
      if (activeAssignments >= 2) {
        setActionError('Anda sudah menangani 2 laporan aktif. Selesaikan atau batalkan salah satunya sebelum mengambil laporan baru.')
        return
      }
    }

    if (
      newStatus === 'Proses' &&
      role === 'admin' &&
      current?.verified_by_role === 'community' &&
      current?.repairer_id !== user?.id
    ) {
      const confirmed = window.confirm(
        'Laporan ini sudah diverifikasi komunitas. Apakah Anda mendapat izin untuk mengambil alih penanganannya sebagai admin?'
      )
      if (!confirmed) return
    }

    setUpdatingId(id)
    setActionError('')
    setActionNotice('')
    try {
      const payload = { status: newStatus }
      if (newStatus === 'Diverifikasi') {
        payload.verified_by = user?.id || null
        payload.verified_by_name = fullName || user?.email || (role === 'community' ? 'Komunitas' : 'Instansi')
        payload.verified_by_avatar_url = user?.user_metadata?.avatar_url || null
        payload.verified_by_role = role
        payload.verified_at = new Date().toISOString()
      }
      if (newStatus === 'Proses') {
        payload.repairer_id = user?.id || null
        payload.repairer_role = role
        payload.repairer_name = fullName || user?.email || (role === 'community' ? 'Komunitas SIJAKA' : 'Instansi')
        payload.repairer_avatar_url = user?.user_metadata?.avatar_url || null
        payload.repair_started_at = new Date().toISOString()
        if (role === 'admin' && current?.verified_by_role === 'community') {
          payload.government_intervened_at = new Date().toISOString()
        }
      }
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('status', current.status)

      if (error) throw error

      const metadata = { ...payload }
      delete metadata.status
      if (Object.keys(metadata).length > 0) {
        const { error: metadataError } = await supabase
          .from('reports')
          .update(metadata)
          .eq('id', id)
          .eq('status', newStatus)
        if (metadataError) {
          console.warn('Metadata status laporan tidak tersimpan:', metadataError)
          setActionNotice('Status berhasil diubah, tetapi sebagian detail penanggung jawab belum tersimpan.')
        }
      }

      if (newStatus === 'Diverifikasi') setExpandedId(id)
      if (role === 'admin' && newStatus === 'Proses' && current?.verified_by_role === 'community') {
        setActionNotice('Instansi mengambil alih laporan yang sebelumnya sudah diverifikasi komunitas.')
      }
      setReports((prev) =>
        prev
          .map((r) => (r.id === id ? { ...r, ...payload } : r))
          .filter(isWithinRetention)
      )
    } catch (error) {
      console.error('Gagal memperbarui status:', error)
      setActionError(error.message === 'Laporan sudah diklaim pihak lain.'
        ? 'Laporan baru saja ditangani oleh pihak lain. Muat ulang panel untuk melihat penanggung jawabnya.'
        : 'Status laporan belum dapat diperbarui. Coba lagi sebentar.')
    } finally {
      setUpdatingId(null)
    }
  }

  const cancelVerification = async (report) => {
    if (report.status !== 'Diverifikasi' || updatingId) return
    const confirmed = window.confirm('Batalkan verifikasi laporan ini? Status akan dikembalikan menjadi Diterima.')
    if (!confirmed) return

    setUpdatingId(report.id)
    setActionError('')
    setActionNotice('')
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'Diterima',
          verified_by: null,
          verified_by_name: null,
          verified_by_avatar_url: null,
          verified_by_role: null,
          verified_at: null,
          repairer_id: null,
          repairer_name: null,
          repairer_avatar_url: null,
          repairer_role: null,
          repair_started_at: null,
        })
        .eq('id', report.id)
        .eq('status', 'Diverifikasi')

      if (error) throw error
      setReports((current) => current.map((item) => (
        item.id === report.id
          ? { ...item, status: 'Diterima', verified_by: null, verified_by_name: null, verified_by_role: null, verified_at: null, repairer_id: null, repairer_name: null, repairer_role: null, repair_started_at: null }
          : item
      )))
      setActionNotice('Verifikasi dibatalkan. Laporan kembali ke antrean untuk diverifikasi ulang.')
    } catch (error) {
      console.error('Gagal membatalkan verifikasi:', error)
      setActionError('Verifikasi belum dapat dibatalkan. Coba lagi sebentar.')
    } finally {
      setUpdatingId(null)
    }
  }

  const submitDeleteReport = async () => {
    if (role !== 'admin' || !deleteReport || !deleteReason.trim() || deleteSubmitting) return
    setDeleteSubmitting(true)
    setActionError('')
    try {
      const { error: hideError } = await supabase
        .from('reports')
        .update({
          hidden_from_map: true,
          hidden_at: new Date().toISOString(),
          hidden_reason: deleteReason.trim(),
          hidden_by: user?.id || null,
        })
        .eq('id', deleteReport.id)
      if (hideError) throw hideError

      setReports((current) => current.filter((report) => report.id !== deleteReport.id))
      setActionNotice('Laporan disembunyikan dari peta dan dihapus dari panel. Alasan tersimpan di Laporan Saya.')
      setDeleteReport(null)
      setDeleteReason('')
    } catch {
      setActionError('Laporan belum dapat disembunyikan dari peta. Coba lagi sebentar.')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const requestTakeover = async (report) => {
    const reason = window.prompt('Alasan instansi meminta mengambil alih laporan ini:')?.trim()
    if (!reason) return
    setUpdatingId(report.id)
    setActionError('')
    try {
      const { error } = await supabase.from('reports').update({
        takeover_status: 'pending',
        takeover_requested_by: user?.id || null,
        takeover_requested_by_name: fullName || user?.email || 'Instansi',
        takeover_requested_at: new Date().toISOString(),
        takeover_reason: reason,
      }).eq('id', report.id).eq('status', 'Proses').eq('repairer_role', 'community')
      if (error) throw error
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, takeover_status: 'pending', takeover_reason: reason } : item))
      setActionNotice('Permintaan pengambilalihan dikirim kepada komunitas penanggung jawab.')
    } catch {
      setActionError('Permintaan pengambilalihan belum terkirim. Coba lagi sebentar.')
    } finally {
      setUpdatingId(null)
    }
  }

  const respondToTakeover = async (report, approved) => {
    if (role !== 'community' || report.takeover_status !== 'pending' || report.repairer_id !== user?.id) return
    setUpdatingId(report.id)
    setActionError('')
    try {
      const { error } = await supabase.from('reports').update({
        takeover_status: approved ? 'approved' : 'rejected',
        takeover_responded_by: user.id,
        takeover_responded_at: new Date().toISOString(),
      }).eq('id', report.id).eq('takeover_status', 'pending').eq('repairer_id', user.id)
      if (error) throw error
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, takeover_status: approved ? 'approved' : 'rejected' } : item))
      setActionNotice(approved ? 'Pengambilalihan disetujui.' : 'Permintaan pengambilalihan ditolak.')
    } catch {
      setActionError('Jawaban atas permintaan pengambilalihan belum tersimpan. Coba lagi.')
    } finally {
      setUpdatingId(null)
    }
  }

  const takeOverReport = async (report, emergency = false) => {
    if (role !== 'admin' || report.status !== 'Proses' || report.repairer_role !== 'community') return
    if (!emergency && report.takeover_status !== 'approved') return
    const reason = emergency
      ? window.prompt('Alasan pengambilalihan darurat:')?.trim()
      : report.takeover_reason
    if (!reason) return
    setUpdatingId(report.id)
    setActionError('')
    try {
      const { error } = await supabase.from('reports').update({
        repairer_id: user.id,
        repairer_role: 'admin',
        repairer_name: fullName || user.email || 'Instansi',
        repairer_avatar_url: user?.user_metadata?.avatar_url || null,
        repair_started_at: new Date().toISOString(),
        takeover_status: emergency ? 'emergency_taken_over' : 'taken_over',
        takeover_reason: reason,
        government_intervened_at: new Date().toISOString(),
      }).eq('id', report.id).eq('status', 'Proses').eq('repairer_role', 'community')
      if (error) throw error
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, repairer_id: user.id, repairer_role: 'admin', repairer_name: fullName || user.email || 'Instansi', takeover_status: emergency ? 'emergency_taken_over' : 'taken_over' } : item))
      setActionNotice('Laporan berhasil diambil alih instansi.')
    } catch {
      setActionError('Pengambilalihan belum dapat dilakukan. Coba lagi sebentar.')
    } finally {
      setUpdatingId(null)
    }
  }

  const getNextStatus = (current) => {
    const idx = STATUS_FLOW.indexOf(current)
    return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
  }

  const requestComplete = (report) => {
    completionFlowActive.current = true
    setCompletingId(report.id)
    setCompletionFile(null)
    setCompletionPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setCompletionError('')
  }

  const cancelComplete = () => {
    completionFlowActive.current = false
    setCompletingId(null)
    setCompletionFile(null)
    setCompletionPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setCompletionError('')
  }

  const handleCompletionFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCompletionError('File bukti harus berupa gambar.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setCompletionError('Ukuran foto bukti maksimal 8 MB.')
      return
    }
    setCompletionError('')
    setCompletionFile(file)
    setCompletionPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const submitCompletion = async (report) => {
    if (!completionFile) {
      setCompletionError('Foto bukti wajib diupload sebelum menandai selesai.')
      return
    }

    setCompletionSubmitting(true)
    setCompletionError('')

    try {
      const fileName = `completion/${report.id}-${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(fileName, completionFile, { contentType: completionFile.type, upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('report-photos')
        .getPublicUrl(fileName)

      const { data: updatedRows, error: updateError } = await supabase
        .from('reports')
        .update({
          status: 'Selesai',
          completion_photo_url: urlData.publicUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('id', report.id)
        .eq('status', report.status)
        .eq('repairer_id', report.repairer_id || user?.id)
        .select('id')

      if (updateError) {
        await supabase.storage.from('report-photos').remove([fileName])
        throw updateError
      }
      if (!updatedRows?.length) {
        await supabase.storage.from('report-photos').remove([fileName])
        throw new Error('Laporan sudah berubah atau diambil alih pihak lain.')
      }

      setReports((prev) =>
        prev
          .map((r) =>
            r.id === report.id
              ? {
                  ...r,
                  status: 'Selesai',
                  completion_photo_url: urlData.publicUrl,
                  completed_at: new Date().toISOString(),
                }
              : r
          )
          .filter(isWithinRetention)
      )

      cancelComplete()
    } catch (err) {
      console.error('Gagal menyelesaikan laporan:', err)
      setCompletionError(err.message === 'Laporan sudah berubah atau diambil alih pihak lain.'
        ? 'Laporan sudah berubah. Muat ulang data sebelum mencoba lagi.'
        : 'Foto bukti belum tersimpan. Periksa koneksi lalu coba lagi.')
    } finally {
      setCompletionSubmitting(false)
    }
  }

  const openOnMap = (report) => {
    if (!isValidCoordinate(report?.latitude, report?.longitude)) return
    const params = new URLSearchParams({
      id: String(report.id),
      lat: String(report.latitude),
      lng: String(report.longitude),
    })
    navigate(`/map?${params.toString()}`)
  }

  const filteredReports = reports.filter((r) => {
    const statusMatch = statusFilter === 'semua' || r.status === statusFilter
    const damageMatch =
      damageFilter === 'semua' || r.damage_type === damageFilter
    return statusMatch && damageMatch
  })

  const stats = {
    total: reports.length,
    diterima: reports.filter((r) => r.status === 'Diterima').length,
    proses: reports.filter((r) => r.status === 'Proses').length,
    selesai: reports.filter((r) => r.status === 'Selesai').length,
  }
  const insight = useMemo(() => getReportInsight(reports, voteCounts), [reports, voteCounts])
  const topPriority = useMemo(() => [...reports].sort((a, b) => getPriorityScore(b, voteCounts) - getPriorityScore(a, voteCounts))[0], [reports, voteCounts])

  return (
    <div className={`ad-page ad-page-${role === 'community' ? 'community' : 'admin'}`}>
      <Navbar />

      <div className="ad-content">
        <section className="ad-hero">
          <div className="ad-hero-glow" aria-hidden="true" />
          <div className="ad-hero-copy">
            <span className="ad-kicker">{role === 'community' ? 'PANEL KOMUNITAS' : 'PANEL INSTANSI'}</span>
            <h1>{role === 'community' ? 'Panel Relawan Jalan' : 'Panel Pengelolaan Laporan'}</h1>
            <p>{role === 'community' ? 'Verifikasi temuan warga, bantu perbaikan jalan, dan unggah bukti penyelesaian tanpa imbalan.' : 'Kelola laporan warga, verifikasi status, dan tinjau detail pelapor dari satu panel.'}</p>
          </div>
          <div className="ad-hero-icon" aria-hidden="true"><img src="/icons/admin.svg?v=sijaka5" alt="" /></div>
        </section>

        {fetchNote && <div className="ad-note">{fetchNote}</div>}
        {actionNotice && <div className="ad-note" role="status">{actionNotice}</div>}
        {actionError && <div className="ad-alert-error" role="alert">{actionError}</div>}

        <div className="ad-stats-strip">
          <div className="ad-stat"><strong>{stats.total}</strong><span>{role === 'community' ? 'TEMUAN WARGA' : 'LAPORAN MASUK'}</span></div>
          <div className="ad-stat" style={{ '--dot-color': statusColors.Diterima }}><strong>{stats.diterima}</strong><span>{role === 'community' ? 'PERLU DICEK' : 'BELUM DIVERIFIKASI'}</span></div>
          <div className="ad-stat" style={{ '--dot-color': statusColors.Proses }}><strong>{stats.proses}</strong><span>{role === 'community' ? 'DIBANTU RELAWAN' : 'DALAM PENANGANAN'}</span></div>
          <div className="ad-stat" style={{ '--dot-color': statusColors.Selesai }}><strong>{stats.selesai}</strong><span>{role === 'community' ? 'SELESAI DIBANTU' : 'SELESAI'}</span></div>
        </div>

        <section className={`ad-ai-panel ${insight.level}`} aria-label="Rekomendasi AI SIJAKA">
          <div className="ad-ai-badge">AI</div>
          <div className="ad-ai-copy">
            <span>{role === 'community' ? 'ARAHAN KERJA RELAWAN' : 'REKOMENDASI PENANGANAN'}</span>
            <strong>{loading ? 'Menganalisis laporan...' : insight.title}</strong>
            <p>{loading ? 'Mengolah pola kerusakan dan status laporan.' : role === 'community' ? `Bantu laporan prioritas di sekitar Anda. ${insight.action}` : insight.action}</p>
          </div>
          {topPriority && <div className="ad-ai-focus"><small>OBJEK PENANGANAN BERIKUTNYA</small><b>{damageMeta[topPriority.damage_type]?.label || 'Laporan jalan'}</b></div>}
        </section>

        <div className="ad-filters-panel">
          <span className="ad-filters-label">{role === 'community' ? 'Penyaringan temuan warga' : 'Penyaringan laporan'}</span>
          <div className="ad-filters">
            <Link to="/history" className="my-reports-secondary ad-history-link">Riwayat</Link>
            <div className="ad-filter-group" role="group" aria-label="Saring berdasarkan status">
              <span>Status</span>
              <div className="ad-filter-choices">
                {['semua', ...STATUS_FLOW].map((value) => (
                  <button key={value} type="button" className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)} aria-pressed={statusFilter === value}>
                    {value === 'semua' ? 'Semua' : value}
                  </button>
                ))}
              </div>
            </div>
            <div className="ad-filter-group" role="group" aria-label="Saring berdasarkan jenis kerusakan">
              <span>Jenis jalan</span>
              <div className="ad-filter-choices">
                <button type="button" className={damageFilter === 'semua' ? 'active' : ''} onClick={() => setDamageFilter('semua')} aria-pressed={damageFilter === 'semua'}>Semua</button>
                {Object.entries(DAMAGE_TYPES).map(([value, meta]) => (
                  <button type="button" className={damageFilter === value ? 'active' : ''} onClick={() => setDamageFilter(value)} aria-pressed={damageFilter === value} key={value}>{meta.label}</button>
                ))}
              </div>
            </div>

            <button type="button" className="ad-refresh-btn" onClick={fetchReports}>
              Muat ulang
            </button>
          </div>
        </div>

        {loading ? (
          <p className="ad-loading">Memuat laporan...</p>
        ) : filteredReports.length === 0 ? (
          <p className="ad-loading">
            Tidak ada laporan yang cocok dengan filter.
          </p>
        ) : (
          <div className="ad-list">
            {filteredReports.map((report) => {
              const isExpanded = expandedId === report.id
              const info = report.reporter || pickReporter(report)
              const meta = damageMeta[report.damage_type] || damageMeta.lubang

              return (
                <div key={report.id} className="ad-card">
                  {report.photo_url ? (
                    <img
                      src={report.photo_url}
                      alt="Kerusakan"
                      className="ad-card-photo"
                      onClick={() => openOnMap(report)}
                      title="Buka lokasi pada peta"
                    />
                  ) : (
                    <div className="ad-card-photo ad-card-photo-empty" aria-label="Foto kerusakan tidak tersedia">
                      <span>Foto tidak tersedia</span>
                    </div>
                  )}

                  <div className="ad-card-body">
                    <div className="ad-card-top">
                      <span
                        className="ad-damage-link"
                        onClick={() => openOnMap(report)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ')
                            openOnMap(report)
                        }}
                      >
                        <img
                          src={meta.icon}
                          alt=""
                          className="ad-damage-icon"
                        />
                        {meta.label}
                      </span>
                      <span
                        className="ad-status-badge"
                        style={{ background: statusColors[report.status] }}
                      >
                        {report.status}
                      </span>
                    </div>

                    <div className="ad-evidence-status">
                      <span>{voteCounts[report.id] || 0} konfirmasi warga</span>
                    </div>

                    <div className="ad-ownership-status">
                      <span>{role === 'community' ? 'Divalidasi oleh: ' : 'Verifikator: '}{report.verified_by_role === 'community' ? 'Komunitas' : report.verified_by_role === 'admin' ? 'Instansi' : 'Belum ada'}</span>
                      <span>{role === 'community' ? 'Relawan: ' : 'Perbaikan: '}{report.repairer_name || 'Belum ditangani'}</span>
                    </div>

                    {}
                    <p className="ad-description">
                      {report.description || 'Deskripsi belum tersedia.'}
                    </p>

                    <p className="ad-reporter"><img src="/icons/profil.svg" alt="" />{info.label}</p>

                    <p className="ad-date">
                      Dilaporkan:{' '}
                      {new Date(report.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>

                    <button
                      type="button"
                      className="ad-detail-toggle"
                      onClick={() =>
                        setExpandedId((prev) =>
                          prev === report.id ? null : report.id
                        )
                      }
                    >
                      {isExpanded
                        ? '▲ Sembunyikan detail pelapor'
                        : '▼ Detail pelapor'}
                    </button>

                    {isExpanded && (
                      <div className="ad-reporter-detail">
                        <div className="ad-reporter-detail-row">
                          <span className="ad-reporter-detail-label">Penanggung jawab</span>
                          <span className="ad-reporter-detail-value">
                            {report.repairer_name || 'Belum ditangani'}{report.repairer_role ? ` · ${report.repairer_role === 'community' ? 'Komunitas' : 'Instansi'}` : ''}
                          </span>
                        </div>
                        <div className="ad-reporter-detail-row">
                          <span className="ad-reporter-detail-label">Konfirmasi</span>
                          <span className="ad-reporter-detail-value">
                            {report.confirmationVoters?.length
                              ? report.confirmationVoters.map((voter) => voter.label).join(', ')
                              : 'Belum ada user yang mengonfirmasi'}
                          </span>
                        </div>
                        <div className="ad-reporter-detail-row">
                          <span className="ad-reporter-detail-label">Nama</span>
                          <span className="ad-reporter-detail-value">
                            {info.name || report.reporter_name || '—'}
                          </span>
                        </div>
                        <div className="ad-reporter-detail-row">
                          <span className="ad-reporter-detail-label">Email</span>
                          <span className="ad-reporter-detail-value">
                            {info.email || report.reporter_email || '—'}
                          </span>
                        </div>
                        <div className="ad-reporter-detail-row">
                          <span className="ad-reporter-detail-label">User ID</span>
                          <span className="ad-reporter-detail-value mono">
                            {report.user_id || '—'}
                          </span>
                        </div>
                        <div className="ad-reporter-detail-row">
                          <span className="ad-reporter-detail-label">
                            ID Laporan
                          </span>
                          <span className="ad-reporter-detail-value mono">
                            {report.id}
                          </span>
                        </div>
                        <div className="ad-reporter-detail-row">
                          <span className="ad-reporter-detail-label">
                            Koordinat
                          </span>
                          <span className="ad-reporter-detail-value mono">
                            {formatCoordinate(report.latitude)},{' '}
                            {formatCoordinate(report.longitude)}
                          </span>
                        </div>
                        <div className="ad-reporter-detail-row">
                          <span className="ad-reporter-detail-label">Waktu</span>
                          <span className="ad-reporter-detail-value">
                            {new Date(report.created_at).toLocaleString(
                              'id-ID'
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {report.status === 'Selesai' && report.completion_photo_url && (
                      <div className="ad-completion-proof">
                        <p className="ad-completion-proof-label">
                          Foto Bukti Selesai
                        </p>
                        <img
                          src={report.completion_photo_url}
                          alt="Bukti penyelesaian"
                          className="ad-completion-proof-photo"
                        />
                      </div>
                    )}

                    <div className="ad-actions">
                      {getNextStatus(report.status) ? (
                        <button
                          className="ad-advance-btn"
                          disabled={updatingId === report.id}
                          onClick={() => {
                            const next = getNextStatus(report.status)
                            if (next === 'Selesai') {
                              requestComplete(report)
                            } else {
                              updateStatus(report.id, next)
                            }
                          }}
                        >
                          {updatingId === report.id
                            ? 'Menyimpan...'
                            : role === 'community'
                              ? `Tandai "${getNextStatus(report.status)}"`
                              : `Ubah ke "${getNextStatus(report.status)}"`}
                        </button>
                      ) : (
                        <span className="ad-done-label">
                          🔒 Selesai &amp; Terkunci
                        </span>
                      )}

                      <button
                        type="button"
                        className="ad-map-btn"
                        onClick={() => openOnMap(report)}
                        disabled={!isValidCoordinate(report.latitude, report.longitude)}
                      >
                        Buka di Peta
                      </button>

                      {role === 'admin' && (
                        <button
                          type="button"
                          className="ad-delete-report-btn"
                          onClick={() => { setDeleteReport(report); setDeleteReason('') }}
                          disabled={deleteSubmitting || updatingId === report.id}
                        >
                          Sembunyikan dari peta
                        </button>
                      )}

                      {report.status === 'Diverifikasi' && (
                        <button
                          type="button"
                          className="ad-cancel-verification-btn"
                          onClick={() => cancelVerification(report)}
                          disabled={updatingId === report.id}
                        >
                          Batalkan verifikasi
                        </button>
                      )}

                      {role === 'admin' && report.status === 'Proses' && report.repairer_role === 'community' && (
                        report.takeover_status === 'approved' ? (
                          <button type="button" className="ad-takeover-btn" onClick={() => takeOverReport(report)} disabled={updatingId === report.id}>
                            Ambil alih dengan persetujuan
                          </button>
                        ) : report.takeover_status === 'pending' ? (
                          <span className="ad-takeover-pending">Menunggu persetujuan komunitas</span>
                        ) : (
                          <>
                            <button type="button" className="ad-takeover-btn" onClick={() => requestTakeover(report)} disabled={updatingId === report.id}>
                              Minta pengambilalihan
                            </button>
                            <button type="button" className="ad-emergency-btn" onClick={() => takeOverReport(report, true)} disabled={updatingId === report.id}>
                              Ambil alih darurat
                            </button>
                          </>
                        )
                      )}

                      {role === 'community' && report.status === 'Proses' && report.repairer_role === 'community' && report.repairer_id === user?.id && report.takeover_status === 'pending' && (
                        <>
                          <button type="button" className="ad-takeover-btn" onClick={() => respondToTakeover(report, true)} disabled={updatingId === report.id}>
                            Setujui pengambilalihan
                          </button>
                          <button type="button" className="ad-emergency-btn" onClick={() => respondToTakeover(report, false)} disabled={updatingId === report.id}>
                            Tolak permintaan
                          </button>
                        </>
                      )}

                    </div>

                    {completingId === report.id && (
                      <div className="ad-completion-panel">
                        <p className="ad-completion-panel-title">
                          Unggah foto bukti untuk menandai laporan ini
                          "Selesai"
                        </p>
                        <p className="ad-completion-panel-hint">
                          Foto bukti wajib diunggah sebelum status bisa diubah
                          menjadi Selesai.
                        </p>

                        {completionError && (
                          <div className="ad-completion-error">
                            {completionError}
                          </div>
                        )}

                        <label className={`ad-completion-upload ${completionFile ? 'has-file' : ''}`}>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleCompletionFileChange}
                            className="ad-completion-file-input"
                            disabled={completionSubmitting}
                          />
                          <span className="ad-completion-upload-icon" aria-hidden="true">+</span>
                          <span className="ad-completion-upload-copy">
                            <strong>{completionFile ? 'Foto bukti dipilih' : 'Pilih foto bukti'}</strong>
                            <small>{completionFile ? completionFile.name : 'JPG, PNG, atau HEIC'}</small>
                          </span>
                          <span className="ad-completion-upload-action">{completionFile ? 'Ganti foto' : 'Pilih file'}</span>
                        </label>

                        {completionPreview && (
                          <img
                            src={completionPreview}
                            alt="Preview bukti selesai"
                            className="ad-completion-preview-photo"
                          />
                        )}

                        <div className="ad-completion-panel-actions">
                          <button
                            type="button"
                            className="ad-completion-cancel-btn"
                            onClick={cancelComplete}
                            disabled={completionSubmitting}
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            className={`ad-completion-confirm-btn ${completionFile ? 'is-ready' : ''}`}
                            onClick={() => submitCompletion(report)}
                            disabled={completionSubmitting || !completionFile}
                          >
                            {completionSubmitting
                              ? 'Menyimpan...'
                              : role === 'community' ? 'Simpan & Laporkan Selesai' : 'Simpan & Tandai Selesai'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleteReport && (
        <div className="ad-delete-backdrop" role="presentation">
          <section className="ad-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title">
            <div className="ad-delete-icon" aria-hidden="true">!</div>
            <h2 id="admin-delete-title">Hapus laporan?</h2>
            <p>Laporan tetap tersimpan di Laporan Saya, tetapi tidak lagi tampil di peta. Pelapor akan menerima alasan penyembunyian.</p>
            <textarea
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Tulis alasan penghapusan..."
              rows="4"
              maxLength="500"
              disabled={deleteSubmitting}
            />
            {!deleteReason.trim() && <small className="ad-delete-hint">Alasan wajib diisi agar pelapor mendapat penjelasan.</small>}
            <div className="ad-delete-actions">
              <button type="button" className="ad-delete-cancel" onClick={() => setDeleteReport(null)} disabled={deleteSubmitting}>Batal</button>
              <button type="button" className="ad-delete-confirm" onClick={submitDeleteReport} disabled={deleteSubmitting || !deleteReason.trim()}>
                {deleteSubmitting ? 'Menghapus...' : 'Hapus & beri tahu'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
