import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('SIJAKA runtime error:', error)
    if (!this.isChunkLoadError(error)) return

    const recoveryKey = 'sijaka-chunk-recovery'
    const lastRecovery = Number(sessionStorage.getItem(recoveryKey) || 0)
    if (Date.now() - lastRecovery < 30000) return
    sessionStorage.setItem(recoveryKey, String(Date.now()))

    Promise.all([
      navigator.serviceWorker?.getRegistrations().then((registrations) => (
        Promise.all(registrations.map((registration) => registration.unregister()))
      )),
      caches?.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    ]).finally(() => window.location.reload())
  }

  isChunkLoadError = (error) => {
    const message = String(error?.message || error || '')
    return /dynamically imported module|importing a module script failed|loading chunk|failed to fetch/i.test(message)
  }

  handleReload = () => window.location.reload()

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="app-crash" role="alert">
        <div className="app-crash-card">
          <img src="/logo-sijaka.png" alt="SIJAKA" className="app-crash-logo" />
          <h1>Halaman belum siap ditampilkan</h1>
          <p>Terjadi gangguan saat membuka halaman ini. Coba muat ulang untuk melanjutkan.</p>
          <button type="button" onClick={this.handleReload}>Coba lagi</button>
        </div>
      </main>
    )
  }
}
