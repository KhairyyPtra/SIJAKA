import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { applyAppSettings, getAppSettings, saveAppSettings } from '../lib/appSettings'
import './Settings.css'

const TEXT_SIZES = [
  ['normal', 'Normal'],
  ['large', 'Besar'],
  ['x-large', 'Sangat besar'],
]

const MAP_VIEWS = [
  ['all', 'Semua laporan', 'Lihat seluruh laporan jalan yang tersedia.'],
  ['nearby', 'Di sekitar saya', 'Mulai dari laporan yang dekat dengan lokasi Anda.'],
  ['mine', 'Laporan saya', 'Tampilkan laporan yang Anda kirim.'],
]

const MAP_LAYERS = [
  ['standard', 'Peta standar', 'Gunakan tampilan jalan dan nama lokasi yang ringan.'],
  ['satellite', 'Satelit', 'Gunakan citra satelit untuk melihat kondisi area secara visual.'],
]

export default function Settings() {
  const [settings, setSettings] = useState(getAppSettings)

  useEffect(() => {
    applyAppSettings(settings)
  }, [settings])

  const update = (changes) => {
    const next = saveAppSettings(changes)
    setSettings(next)
  }

  return (
    <div className="settings-page">
      <Navbar />
      <main className="settings-content">
        <section className="settings-hero">
          <div>
            <span className="settings-kicker">PENGATURAN APLIKASI</span>
            <h1>Atur SIJAKA agar nyaman digunakan.</h1>
            <p>Sesuaikan tampilan, peta, dan cara aplikasi memberi kabar kepada Anda.</p>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="reading-title">
          <div className="settings-section-heading">
            <span className="settings-section-number">01</span>
            <div>
              <h2 id="reading-title">Kenyamanan membaca</h2>
              <p>Pengaturan ini berlaku di semua halaman pada perangkat ini.</p>
            </div>
          </div>
          <div className="settings-option-grid settings-text-options" role="group" aria-label="Ukuran teks">
            {TEXT_SIZES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`settings-choice ${settings.textScale === value ? 'active' : ''}`}
                onClick={() => update({ textScale: value })}
                aria-pressed={settings.textScale === value}
              >
                <strong className={`settings-letter ${value}`}>A</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="settings-toggle-list">
            <label className="settings-toggle">
              <span>
                <strong>Mode gelap</strong>
                <small>Gunakan warna yang lebih redup saat melihat SIJAKA di malam hari.</small>
              </span>
              <input type="checkbox" checked={Boolean(settings.darkMode)} onChange={(event) => update({ darkMode: event.target.checked })} />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Kontras tinggi</strong>
                <small>Membuat teks dan batas panel lebih tegas.</small>
              </span>
              <input type="checkbox" checked={Boolean(settings.highContrast)} onChange={(event) => update({ highContrast: event.target.checked })} />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Kurangi animasi</strong>
                <small>Mengurangi gerakan saat halaman dan peta dibuka.</small>
              </span>
              <input type="checkbox" checked={Boolean(settings.reduceMotion)} onChange={(event) => update({ reduceMotion: event.target.checked })} />
            </label>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="map-title">
          <div className="settings-section-heading">
            <span className="settings-section-number">02</span>
            <div>
              <h2 id="map-title">Peta dan koneksi</h2>
              <p>Atur jumlah data yang dimuat saat menggunakan jaringan seluler.</p>
            </div>
          </div>
          <div className="settings-toggle-list">
            <label className="settings-toggle">
              <span>
                <strong>Hemat data</strong>
                <small>Kurangi pemuatan media dan detail peta saat koneksi terbatas.</small>
              </span>
              <input type="checkbox" checked={Boolean(settings.dataSaver)} onChange={(event) => update({ dataSaver: event.target.checked })} />
            </label>
          </div>
          <div className="settings-field">
            <span className="settings-field-label">Jenis tampilan peta</span>
            <div className="settings-choice-stack" role="group" aria-label="Jenis tampilan peta">
              {MAP_LAYERS.map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  className={`settings-choice settings-map-choice ${settings.mapLayer === value ? 'active' : ''}`}
                  onClick={() => update({ mapLayer: value })}
                  aria-pressed={settings.mapLayer === value}
                >
                  <span className="settings-choice-radio" aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="settings-field">
            <span className="settings-field-label">Saat membuka peta</span>
            <div className="settings-choice-stack" role="group" aria-label="Tampilan peta awal">
              {MAP_VIEWS.map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  className={`settings-choice settings-map-choice ${settings.mapView === value ? 'active' : ''}`}
                  onClick={() => update({ mapView: value })}
                  aria-pressed={settings.mapView === value}
                >
                  <span className="settings-choice-radio" aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="privacy-title">
          <div className="settings-section-heading">
            <span className="settings-section-number">03</span>
            <div>
              <h2 id="privacy-title">Privasi dan kabar</h2>
              <p>Anda tetap memegang kendali atas fitur yang memakai perangkat Anda.</p>
            </div>
          </div>
          <div className="settings-toggle-list">
            <label className="settings-toggle">
              <span>
                <strong>Pengingat status laporan</strong>
                <small>Izinkan SIJAKA memberi tahu saat status laporan berubah.</small>
              </span>
              <input type="checkbox" checked={Boolean(settings.notifications)} onChange={(event) => update({ notifications: event.target.checked })} />
            </label>
            <label className="settings-toggle">
              <span>
                <strong>Gunakan lokasi perangkat</strong>
                <small>Lokasi hanya dipakai saat Anda mencari atau mengirim laporan.</small>
              </span>
              <input type="checkbox" checked={Boolean(settings.locationAccess)} onChange={(event) => update({ locationAccess: event.target.checked })} />
            </label>
          </div>
        </section>

        <Link to="/profile" className="settings-account-link">Buka pengaturan akun <span aria-hidden="true">→</span></Link>
      </main>
    </div>
  )
}
