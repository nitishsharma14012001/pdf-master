import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Suspense, lazy } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConsentProvider } from './context/ConsentContext'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ScrollToTop from './components/ui/ScrollToTop'
import RouteTracker from './components/ui/RouteTracker'
import CookieBanner from './components/ui/CookieBanner'
import { LoginPage, SignupPage, ForgotPasswordPage } from './components/auth/AuthPages'
import { ContactPage, PrivacyPage, TermsPage, AboutPage, NotFoundPage } from './components/pages/StaticPages'

// Lazy-loaded pages for code splitting / performance
const HomePage    = lazy(() => import('./components/pages/HomePage'))
const ToolPage    = lazy(() => import('./components/pages/ToolPage'))
const DashboardPage = lazy(() => import('./components/pages/DashboardPage'))
const AdminPage   = lazy(() => import('./components/pages/AdminPage'))
const PricingPage = lazy(() => import('./components/pages/PricingPage'))

/** Skeleton shown while lazy chunks load */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl animate-pulse"
          style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
        />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    </div>
  )
}

/** Redirects unauthenticated users; optionally requires admin role */
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

/** Shared layout: sticky Navbar + scrollable main + Footer */
function Layout({ children, noFooter = false }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </main>
      {!noFooter && <Footer />}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* ConsentProvider wraps BrowserRouter so RouteTracker can
            read consentState and so CookieBanner can link to /privacy */}
        <ConsentProvider>
          <BrowserRouter>
            <ScrollToTop />
            {/* Fires a GA4 page view on every route change */}
            <RouteTracker />
            {/* Cookie consent banner — shown once to new visitors */}
            <CookieBanner />

            {/* Toast notifications */}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3500,
                style: {
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                },
              }}
            />

            <Routes>
              {/* ── Public ─────────────────────────────────────────── */}
              <Route path="/"              element={<Layout><HomePage /></Layout>} />
              <Route path="/tools/:toolId" element={<Layout><ToolPage /></Layout>} />
              <Route path="/pricing"       element={<Layout><PricingPage /></Layout>} />
              <Route path="/about"         element={<Layout><AboutPage /></Layout>} />
              <Route path="/contact"       element={<Layout><ContactPage /></Layout>} />
              <Route path="/privacy"       element={<Layout><PrivacyPage /></Layout>} />
              <Route path="/terms"         element={<Layout><TermsPage /></Layout>} />

              {/* ── Auth ───────────────────────────────────────────── */}
              <Route path="/login"           element={<Layout noFooter><LoginPage /></Layout>} />
              <Route path="/signup"          element={<Layout noFooter><SignupPage /></Layout>} />
              <Route path="/forgot-password" element={<Layout noFooter><ForgotPasswordPage /></Layout>} />

              {/* ── Protected ──────────────────────────────────────── */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout><DashboardPage /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute adminOnly>
                  <Layout><AdminPage /></Layout>
                </ProtectedRoute>
              } />

              {/* ── 404 ────────────────────────────────────────────── */}
              <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
            </Routes>
          </BrowserRouter>
        </ConsentProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
