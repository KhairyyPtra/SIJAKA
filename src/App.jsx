import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import PlatformShell from './components/PlatformShell'
import { applyAppSettings, getAppSettings } from './lib/appSettings'
import { supabaseConfigError } from './lib/supabaseclient'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const VerifyOtp = lazy(() => import('./pages/VerifyOtp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const HazardMap = lazy(() => import('./pages/HazardMap'))
const ReportForm = lazy(() => import('./pages/ReportForm'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const Settings = lazy(() => import('./pages/Settings'))

const Profile = lazy(() => import('./pages/Profile'))
const MyReports = lazy(() => import('./pages/MyReports'))
const HistoryDashboard = lazy(() => import('./pages/HistoryDashboard'))
const About = lazy(() => import('./pages/About'))

function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const previousScrollBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    document.documentElement.style.scrollBehavior = previousScrollBehavior
  }, [pathname])

  return null
}

function App() {
  useEffect(() => {
    const applySettings = (event) => applyAppSettings(event?.detail || getAppSettings())
    applySettings()
    window.addEventListener('sijaka:app-settings', applySettings)
    return () => window.removeEventListener('sijaka:app-settings', applySettings)
  }, [])

  if (supabaseConfigError) {
    return (
      <main className="app-crash" role="alert">
        <div className="app-crash-card">
          <img src="/logo-sijaka.png" alt="SIJAKA" className="app-crash-logo" />
          <h1>Konfigurasi belum lengkap</h1>
          <p>Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Environment Variables Vercel, lalu deploy ulang.</p>
        </div>
      </main>
    )
  }

  return (
    <ErrorBoundary>
      <div className="app-shell">
      <AuthProvider>
      <BrowserRouter>
        <PlatformShell>
        <ScrollToTop />
        <Suspense fallback={<div className="app-loading" role="status" aria-live="polite"><div className="app-loading-spinner" /><span>Memuat SIJAKA...</span></div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/settings" element={<ProtectedRoute allowGuest><Settings /></ProtectedRoute>} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowGuest>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/map"
            element={
              <ProtectedRoute allowGuest>
                <HazardMap />
              </ProtectedRoute>
            }
          />

          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute allowGuest>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-reports"
            element={
              <ProtectedRoute>
                <MyReports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute allowGuest>
                <HistoryDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/about"
            element={
              <ProtectedRoute allowGuest>
                <About />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          <Route
            path="/community"
            element={
              <AdminRoute allowedRole="community">
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
        </Suspense>
        </PlatformShell>
      </BrowserRouter>
      </AuthProvider>
      </div>
    </ErrorBoundary>
  )
}

export default App
