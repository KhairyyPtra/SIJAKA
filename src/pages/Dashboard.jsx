import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseclient'
import { DAMAGE_TYPES } from '../lib/damageTypes'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/useAuth'
import './Dashboard.css'

const NEWS_LIMIT = 3
const SEVERE_DAMAGE_TYPES = new Set(['banjir', 'amblas', 'lubang'])
const NEWS_HEADLINES = {
  banjir: [
    'Banjir mulai menggenangi ruas jalan warga',
    'Genangan tinggi dilaporkan menghambat perjalanan',
    'Akses jalan terganggu setelah hujan deras',
    'Pengendara diminta waspada terhadap genangan',
    'Ruas jalan tergenang, warga melaporkan kondisi darurat',
    'Air menggenangi badan jalan dan memperlambat kendaraan',
    'Genangan di jalan membuat akses warga terganggu',
    'Hujan memicu genangan di jalur yang ramai dilalui',
    'Kondisi banjir di ruas jalan perlu segera ditangani',
    'Warga melaporkan jalan tergenang cukup tinggi',
    'Arus kendaraan terhambat akibat banjir di jalan',
    'Titik genangan baru dilaporkan membahayakan perjalanan',
  ],
  amblas: [
    'Badan jalan amblas dan membahayakan pengguna jalan',
    'Kerusakan tepi jalan dilaporkan semakin melebar',
    'Pengendara diminta menghindari titik jalan amblas',
    'Jalur warga terdampak amblesnya badan jalan',
    'Kondisi jalan amblas perlu segera mendapat penanganan',
    'Sebagian badan jalan turun dan mengganggu akses warga',
    'Jalan amblas menjadi titik rawan bagi kendaraan',
    'Warga menandai kerusakan serius pada badan jalan',
    'Permukaan jalan ambles, pengguna diminta lebih berhati-hati',
    'Akses kendaraan terganggu akibat badan jalan yang turun',
    'Tepi ruas jalan amblas dan berisiko bagi pengendara',
    'Laporan jalan amblas masuk untuk segera ditindaklanjuti',
  ],
  lubang: [
    'Lubang besar membahayakan pengendara yang melintas',
    'Kerusakan permukaan jalan mulai dikeluhkan warga',
    'Pengendara diminta mengurangi kecepatan di titik ini',
    'Lubang jalan dilaporkan mengganggu arus kendaraan',
    'Warga menandai titik rawan kecelakaan di ruas jalan',
    'Lubang di badan jalan mengancam keselamatan pengendara',
    'Pengguna jalan melaporkan lubang yang semakin dalam',
    'Kendaraan perlu waspada saat melintasi titik berlubang',
    'Permukaan jalan rusak menyulitkan kendaraan melintas',
    'Lubang jalan muncul di jalur yang digunakan warga',
    'Titik jalan berlubang dilaporkan perlu segera diperbaiki',
    'Kerusakan jalan berpotensi memicu kecelakaan',
  ],
}

function pickHeadline(report) {
  const headlines = NEWS_HEADLINES[report.damage_type]
  if (!headlines) return 'Kerusakan jalan dilaporkan warga'

  const source = `${report.id || ''}${report.created_at || ''}`
  const hash = [...source].reduce((total, character) => total + character.charCodeAt(0), 0)
  return headlines[hash % headlines.length]
}

function formatNewsDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Baru saja'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function reportToNews(report, role) {
  const meta = DAMAGE_TYPES[report.damage_type] || { label: 'Kerusakan jalan', icon: '/icons/lapor.svg' }
  const status = report.status || 'Diterima'
  const isAdmin = role === 'admin'
  const isCommunity = role === 'community'
  const headline = pickHeadline(report)
  return {
    id: report.id,
    category: status.toUpperCase(),
    date: formatNewsDate(report.created_at),
    title: headline,
    summary: isAdmin
      ? `Laporan ini berstatus ${status}. Detail lokasi tersedia untuk segera ditindaklanjuti.`
      : isCommunity
        ? `Temuan ini berstatus ${status}. Kondisi lapangan perlu divalidasi dan ditindaklanjuti.`
        : `Laporan warga ini berstatus ${status}. Simak titik kejadian dan detailnya di peta.`,
    icon: meta.icon,
    to: `/map?id=${encodeURIComponent(report.id)}`,
    label: isAdmin || isCommunity ? 'Tinjau di peta' : 'Lihat di peta',
  }
}

export default function Dashboard() {
  const { user, role } = useAuth()
  const [reports, setReports] = useState([])

  useEffect(() => {
    let mounted = true
    const fetchLatestReports = async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('id, damage_type, status, created_at, hidden_from_map')
        .eq('hidden_from_map', false)
        .in('damage_type', [...SEVERE_DAMAGE_TYPES])
        .order('created_at', { ascending: false })
        .limit(NEWS_LIMIT)
      if (!mounted || error) return
      setReports(data || [])
    }

    fetchLatestReports()
    const channel = supabase
      .channel('dashboard-news-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
        setReports((current) => {
          if (payload.eventType === 'DELETE') {
            return current.filter((report) => report.id !== payload.old?.id)
          }
          const nextReport = payload.new
          if (!nextReport || nextReport.hidden_from_map || !SEVERE_DAMAGE_TYPES.has(nextReport.damage_type)) {
            return current.filter((report) => report.id !== nextReport?.id)
          }
          return [nextReport, ...current.filter((report) => report.id !== nextReport.id)]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, NEWS_LIMIT)
        })
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const newsItems = reports.map((report) => reportToNews(report, role))

  const roleContent = role === 'admin'
    ? {
        kicker: 'PUSAT KENDALI INSTANSI',
        title: 'Selamat datang, Admin !',
        description: 'Tinjau laporan warga, tetapkan penanganan, dan pantau penyelesaian pekerjaan secara terukur.',
        panelTitle: 'Kelola laporan warga',
        panelDescription: 'Buka panel instansi untuk memverifikasi, mengatur status, dan mengoordinasikan perbaikan.',
        panelPath: '/admin',
        panelLabel: 'Buka panel instansi',
      }
    : role === 'community'
      ? {
          kicker: 'RUANG KERJA RELAWAN',
          title: 'Selamat datang, Relawan !',
          description: 'Pilih temuan warga yang dapat Anda bantu, kerjakan bersama komunitas, dan laporkan hasilnya.',
          panelTitle: 'Mulai kerja relawan',
          panelDescription: 'Buka panel relawan untuk memvalidasi temuan dan menangani perbaikan jalan.',
          panelPath: '/community',
          panelLabel: 'Buka panel relawan',
        }
      : {
          kicker: 'LAYANAN PUBLIK SIJAKA',
          title: 'Informasikan kondisi jalan di sekitar Anda',
          description: 'Laporkan kerusakan jalan dan pantau tindak lanjutnya melalui satu layanan.',
          panelTitle: 'Lapor Kerusakan',
          panelDescription: 'Kirim laporan kerusakan jalan dengan foto dan lokasi GPS otomatis.',
          panelPath: '/report',
          panelLabel: 'Lapor Kerusakan',
        }

  

  const menuItems = [
    {
      to: roleContent.panelPath,
      icon: '/icons/lapor.svg',
      title: roleContent.panelTitle,
      desc: roleContent.panelDescription,
      label: roleContent.panelLabel,
      tone: 'yellow',
      requiresLogin: !user && roleContent.panelPath === '/report',
    },

    {
      to: '/map',
      icon: '/icons/peta.svg',
      title: 'Lihat Kondisi Jalan',
      desc: 'Lihat laporan kerusakan jalan di sekitar Anda melalui peta.',
      label: 'Lihat peta',
      tone: 'yellow',
      requiresLogin: false,
    },
  ]

  return (
    <div className="dashboard-page">

      {}

      <Navbar />

      <main className="dashboard-content">

        {}

        <section className="dashboard-hero">

          <div className="dashboard-hero-copy">

            <span className="dashboard-kicker">{roleContent.kicker}</span>

            <h1>{roleContent.title}</h1>

            <p>{roleContent.description}</p>

          </div>

        </section>

        {}

        <section
          className="dashboard-actions"
          aria-label="Aksi utama"
        >

          {menuItems.map((item) => {

            const content = (
              <>
                <div className="action-icon">
                  <img
                    src={item.icon}
                    alt=""
                  />
                </div>

                <div className="action-copy">

                  <h2>
                    {item.title}
                  </h2>

                  <p>
                    {item.desc}
                  </p>

                </div>

                <span
                  className="action-arrow"
                  aria-hidden="true"
                >
                  →
                </span>
              </>
            )

            

            if (
              item.requiresLogin &&
              !user
            ) {
              return (
                <button
                  type="button"
                  key={item.to}
                  className={`dashboard-action-card ${item.tone}`}
                  onClick={() =>
                    window.dispatchEvent(
                      new Event(
                        'sijaka:guest-report'
                      )
                    )
                  }
                >
                  {content}
                </button>
              )
            }

            

            return (
              <Link
                to={item.to}
                key={item.to}
                className={`dashboard-action-card ${item.tone}`}
              >
                {content}
              </Link>
            )
          })}

        </section>

        <section className="dashboard-news" aria-labelledby="dashboard-news-title">
          <div className="dashboard-news-heading">
            <div>
              <span className="section-eyebrow">PERINGATAN KONDISI JALAN</span>
              <h2 id="dashboard-news-title">
                {role === 'admin'
                  ? 'Prioritas darurat penanganan jalan'
                  : role === 'community'
                    ? 'Temuan darurat yang membutuhkan bantuan'
                    : 'Peringatan terbaru untuk pengguna jalan'}
              </h2>
            </div>
            <span className="dashboard-news-rule" aria-hidden="true" />
          </div>
          <div className="dashboard-news-grid">
            {newsItems.length ? newsItems.map((item) => (
              <article className="dashboard-news-card" key={item.id}>
                <div className="dashboard-news-card-top">
                  <span className="dashboard-news-icon"><img src={item.icon} alt="" /></span>
                  <span className="dashboard-news-date">{item.date}</span>
                </div>
                <span className="dashboard-news-category">{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <Link to={item.to} className="dashboard-news-link">
                  {item.label} <span aria-hidden="true">→</span>
                </Link>
              </article>
            )) : (
              <div className="dashboard-news-empty">Belum ada laporan terbaru untuk ditampilkan.</div>
            )}
          </div>
        </section>

        {}

        {!['admin', 'community'].includes(role) && (
        <section className="how-section">

          <div className="section-heading centered">

            <span className="section-eyebrow">
              CARA MELAPOR DI SIJAKA
            </span>

            <span className="section-line" />

          </div>

          <div className="steps-grid">

            {}

            <div className="step">

              <span>
                01
              </span>

              <div>

                <h3>
                  Lapor
                </h3>

                <p>
                  Buka menu lapor dan
                  dokumentasikan kondisi jalan.
                </p>

              </div>

            </div>

            {}

            <div className="step">

              <span>
                02
              </span>

              <div>

                <h3>
                  GPS Otomatis
                </h3>

                <p>
                  Lokasi perangkat dideteksi
                  otomatis untuk memetakan laporan.
                </p>

              </div>

            </div>

            {}

            <div className="step">

              <span>
                03
              </span>

              <div>

                <h3>
                  Lengkapi
                </h3>

                <p>
                  Pilih jenis kerusakan,
                  tulis deskripsi, lalu kirim laporan.
                </p>

              </div>

            </div>

            {}

            <div className="step">

              <span>
                04
              </span>

              <div>

                <h3>
                  Pantau
                </h3>

                <p>
                  Lihat perkembangan laporan
                  sampai selesai ditangani.
                </p>

              </div>

            </div>

          </div>

        </section>
        )}

        {}

        <footer className="dashboard-footer">

          <img
            src="/logo-sijaka.png"
            alt=""
          />

          <div>

            <strong>
              SIJAKA
            </strong>

            <span>
              Sistem Informasi 
              Jalan Kota
            </span>

          </div>

          <Link
            to="/about"
            className="dashboard-about-link"
          >
            Tentang
          </Link>

        </footer>

      </main>
    </div>
  )
}