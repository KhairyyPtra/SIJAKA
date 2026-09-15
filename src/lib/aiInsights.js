const TYPE_LABELS = {
  lubang: 'jalan berlubang',
  retak: 'retakan jalan',
  banjir: 'genangan atau banjir',
  amblas: 'jalan amblas',
  drainase: 'drainase rusak',
  marka: 'marka jalan pudar',
}

const TYPE_PRIORITY = { banjir: 3, amblas: 3, lubang: 2, drainase: 2, retak: 1, marka: 1 }

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || 'lainnya'
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {})
}

function topEntry(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || null
}

export function getReportInsight(reports = [], voteCounts = {}) {
  if (!reports.length) {
    return {
      level: 'normal',
      title: 'Belum ada pola yang cukup kuat',
      summary: 'Tambahkan beberapa laporan untuk mendapatkan rekomendasi prioritas wilayah.',
      action: 'Mulai dari laporan dengan foto dan lokasi GPS yang lengkap.',
      score: 0,
    }
  }

  const typeCounts = countBy(reports, 'damage_type')
  const statusCounts = countBy(reports, 'status')
  const topType = topEntry(typeCounts)
  const activeReports = reports.filter((report) => report.status !== 'Selesai')
  const urgentReports = reports.filter((report) => ['banjir', 'amblas', 'lubang'].includes(report.damage_type) && report.status !== 'Selesai')
  const recentReports = reports.filter((report) => Date.now() - new Date(report.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000)
  const votedActiveReports = activeReports.filter((report) => (voteCounts[report.id] || 0) > 0)
  const totalVotes = activeReports.reduce((total, report) => total + (voteCounts[report.id] || 0), 0)
  const topVotedReport = [...votedActiveReports].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))[0]
  const score = Math.min(100, urgentReports.length * 18 + recentReports.length * 7 + activeReports.length * 3 + Math.min(20, totalVotes * 2))
  const level = score >= 65 ? 'tinggi' : score >= 30 ? 'perhatian' : 'normal'

  let action = 'Pertahankan pemantauan dan lengkapi laporan yang belum memiliki detail lokasi.'
  if (urgentReports.length) action = `Prioritaskan pemeriksaan ${urgentReports.length} laporan berisiko tinggi sebelum laporan lainnya.`
  if (topType) action += ` Pola terbanyak saat ini adalah ${TYPE_LABELS[topType[0]] || topType[0]} (${topType[1]} laporan).`
  if (topVotedReport) action += ` ${voteCounts[topVotedReport.id]} konfirmasi warga menandai laporan ${TYPE_LABELS[topVotedReport.damage_type] || 'jalan'} sebagai perhatian komunitas.`

  return {
    level,
    title: level === 'tinggi' ? 'Perlu perhatian cepat' : level === 'perhatian' ? 'Ada pola yang perlu dipantau' : 'Kondisi relatif terkendali',
    summary: `${activeReports.length} laporan masih aktif dan ${recentReports.length} laporan masuk dalam 7 hari terakhir.`,
    action,
    score,
    totalVotes,
    votedActiveReports: votedActiveReports.length,
    typeCounts,
    statusCounts,
  }
}

export function getPriorityScore(report, voteCounts = {}) {
  const typeScore = TYPE_PRIORITY[report.damage_type] || 0
  const statusScore = report.status === 'Diterima' ? 2 : report.status === 'Proses' ? 1 : 0
  const hasLocation = Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude))
  const voteScore = report.status === 'Selesai' ? 0 : Math.min(6, voteCounts[report.id] || 0)
  return typeScore * 3 + statusScore + (hasLocation ? 1 : 0) + voteScore
}