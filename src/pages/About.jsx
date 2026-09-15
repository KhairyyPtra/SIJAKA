import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import alfarizaPhoto from '../assets/Alfariza Febrian.png'
import laOdePhoto from '../assets/la-ode-muhammad-ibrahim.jpg'
import amarPhoto from '../assets/Muhammad Amar Danis Ilyas.jpeg'
import zafranPhoto from '../assets/zafran-khairy-marwan-putra.jpeg'
import './About.css'

const team = [
  { initials: 'LO', name: 'La Ode Muh. Ibrahim', tone: 'gold', photo: laOdePhoto, nisn: '0098746937', email: 'leopie279@gmail.com' },
  { initials: 'ZK', name: 'Zafran Khairy Marwan Putra', tone: 'blue', photo: zafranPhoto, nisn: '0092974784', email: 'zafrannkhairyymp@gmail.com' },
  { initials: 'AF', name: 'Alfariza Febrian', tone: 'red', photo: alfarizaPhoto, nisn: '', email: 'alfarizafebrian@gmail.com' },
  { initials: 'MA', name: 'Muh. Amar Danis Ilyas', tone: 'green', photo: amarPhoto, nisn: '3095549713', email: 'amardnias@gmail.com' },
]

export default function About() {
  const [selectedMember, setSelectedMember] = useState(null)

  useEffect(() => {
    if (!selectedMember) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedMember(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedMember])

  return (
    <div className="about-page">
      <Navbar />

      <main className="about-content">
        <section className="about-hero">
          <div className="about-hero-copy">
            <span className="about-kicker">TENTANG SIJAKA</span>
            <h1>Satu tempat untuk melaporkan kerusakan jalan.</h1>
            <p>
              SIJAKA membantu warga mengirim laporan dengan foto, keterangan, dan lokasi
              yang jelas kepada pihak yang dapat menanganinya.
            </p>
          </div>
          <div className="about-hero-mark" aria-hidden="true">
            <img src="/logo-sijaka.png" alt="" />
            <span>LAPORAN JALAN</span>
          </div>
        </section>

        <section className="about-story">
          <div className="about-section-heading">
            <span className="about-kicker">CERITA KAMI</span>
            <h2>Kenapa SIJAKA dibuat?</h2>
          </div>
          <div className="about-story-grid">
            <p>
              Kerusakan jalan sering terlihat setiap hari, tetapi tidak selalu mudah
              disampaikan dengan lengkap.
            </p>
            <p>
              Di sini, warga dapat mengirim laporan, melihat lokasinya di peta, dan
              mengikuti perkembangan penanganannya.
            </p>
          </div>
        </section>

        <section className="about-principles" aria-label="Cara SIJAKA bekerja">
          <article className="about-principle">
            <span>01</span>
            <div>
              <h3>Kirim laporan</h3>
              <p>Tambahkan foto, keterangan singkat, dan lokasi kerusakan.</p>
            </div>
          </article>
          <article className="about-principle">
            <span>02</span>
            <div>
              <h3>Lihat di peta</h3>
              <p>Laporan ditampilkan berdasarkan lokasi dan jenis kerusakannya.</p>
            </div>
          </article>
          <article className="about-principle">
            <span>03</span>
            <div>
              <h3>Pantau tindak lanjut</h3>
              <p>Perubahan status membantu warga mengetahui perkembangan laporan.</p>
            </div>
          </article>
        </section>

        <section className="about-team" aria-labelledby="team-title">
          <div className="about-section-heading about-team-heading">
            <div>
              <span className="about-kicker">TIM SIJAKA</span>
              <h2 id="team-title">Orang-orang di balik SIJAKA.</h2>
            </div>
            <span className="about-team-count">Tim pengembang</span>
          </div>

          <div className="about-team-grid">
            {team.map((member) => (
              <article
                className="about-member"
                key={member.name}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedMember(member)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedMember(member)
                  }
                }}
                aria-label={`Lihat detail ${member.name}`}
              >
                <div className={`about-member-photo ${member.tone}`} aria-label={`Foto ${member.name}`}>
                  {member.photo ? <img src={member.photo} alt={`Foto ${member.name}`} /> : <span>{member.initials}</span>}
                </div>
                <div className="about-member-info">
                  <h3>{member.name}</h3>
                </div>
              </article>
            ))}
          </div>
        </section>

      </main>

      {selectedMember && (
        <div className="about-member-backdrop" role="presentation" onClick={() => setSelectedMember(null)}>
          <section
            className="about-member-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-member-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="about-member-dialog-close" onClick={() => setSelectedMember(null)} aria-label="Tutup detail pengembang">×</button>
            <div className={`about-member-dialog-photo ${selectedMember.tone}`}>
              {selectedMember.photo ? <img src={selectedMember.photo} alt={`Foto ${selectedMember.name}`} /> : <span>{selectedMember.initials}</span>}
            </div>
            <span className="about-kicker">PENGEMBANG SIJAKA</span>
            <h2 id="about-member-dialog-title">{selectedMember.name}</h2>
            <dl className="about-member-details">
              <div><dt>NISN</dt><dd>{selectedMember.nisn || 'Belum ditambahkan'}</dd></div>
              <div><dt>Email</dt><dd>{selectedMember.email || 'Belum ditambahkan'}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </div>
  )
}