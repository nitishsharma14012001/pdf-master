/**
 * PDF Master — AdminPage.jsx  (REPLACE existing file)
 *
 * Production admin panel with:
 *  - Sidebar navigation (collapsible on mobile)
 *  - 5 sub-pages: Dashboard, Analytics, Logs, Server, Settings
 *  - Dark/light mode aware
 *  - Access gate: redirects non-admin users
 *  - Lazy-loaded sub-pages for code splitting
 */

import { useState, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BarChart3, ScrollText, Server,
  Settings, Shield, ChevronRight, Menu, X,
  LogOut, Moon, Sun, FileText, Home,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { CardSkeleton } from './admin/AdminShared'

// Lazy-load each sub-page for code splitting
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))
const AdminAnalytics = lazy(() => import('./admin/AdminAnalytics'))
const AdminLogs      = lazy(() => import('./admin/AdminLogs'))
const AdminServer    = lazy(() => import('./admin/AdminServer'))
const AdminSettings  = lazy(() => import('./admin/AdminSettings'))

const G = { blue: '#2563eb', violet: '#7c3aed' }

// ─────────────────────────────────────────────────────────────────────────────
// Nav items
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard, component: AdminDashboard },
  { key: 'analytics', label: 'Analytics',  icon: BarChart3,       component: AdminAnalytics },
  { key: 'logs',      label: 'Logs',       icon: ScrollText,      component: AdminLogs      },
  { key: 'server',    label: 'Server',     icon: Server,          component: AdminServer    },
  { key: 'settings',  label: 'Settings',   icon: Settings,        component: AdminSettings  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, collapsed, setCollapsed, onClose }) {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <aside
      className="flex flex-col h-full"
      style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${G.blue}, ${G.violet})` }}>
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-extrabold leading-tight" style={{
              background: `linear-gradient(135deg, ${G.blue}, ${G.violet})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>PDF Master</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Admin Panel</p>
          </div>
        )}
        {/* Mobile close */}
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label="Close menu">
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2" role="navigation" aria-label="Admin navigation">
        <ul className="space-y-1" role="list">
          {NAV_ITEMS.map(item => {
            const isActive = active === item.key
            return (
              <li key={item.key}>
                <button
                  onClick={() => { setActive(item.key); onClose?.() }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  style={isActive
                    ? { background: `linear-gradient(135deg, ${G.blue}18, ${G.violet}18)`, color: G.blue }
                    : { color: 'var(--text-muted)' }
                  }
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? '' : 'group-hover:text-blue-500'}`}
                    style={{ color: isActive ? G.blue : undefined }} />
                  {!collapsed && (
                    <span className="flex-1 text-left">{item.label}</span>
                  )}
                  {!collapsed && isActive && (
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: G.blue }} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {/* Divider */}
        <div className="my-4 mx-2 h-px" style={{ background: 'var(--border)' }} />

        {/* Links to app */}
        <ul className="space-y-1" role="list">
          <li>
            <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-blue-50 dark:hover:bg-blue-950/30"
              style={{ color: 'var(--text-muted)' }}>
              <Home className="w-4 h-4 shrink-0" />
              {!collapsed && 'Back to App'}
            </Link>
          </li>
        </ul>
      </nav>

      {/* User section */}
      <div className="px-2 pb-4 shrink-0 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-blue-50 dark:hover:bg-blue-950/30 mb-1"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4 shrink-0" />
            : <Moon className="w-4 h-4 shrink-0" />}
          {!collapsed && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
        </button>

        {/* User avatar + logout */}
        {user && (
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${G.blue}, ${G.violet})` }}>
              {user.name?.[0] || 'A'}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{user.name}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                </div>
                <button onClick={logout} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" aria-label="Sign out">
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading fallback
// ─────────────────────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-7 w-40 rounded-xl animate-pulse" style={{ background: 'var(--border)' }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} lines={2} />)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Access denied
// ─────────────────────────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-secondary)' }}>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: '#ef444418' }}>
          <Shield className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>Access Denied</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          You need admin privileges to view this page.
        </p>
        <Link to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${G.blue}, ${G.violet})` }}>
          <Home className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AdminPage
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth()
  const [active, setActive]       = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed]   = useState(false)

  // Guard
  if (!user || user.role !== 'admin') return <AccessDenied />

  const activeItem    = NAV_ITEMS.find(n => n.key === active) || NAV_ITEMS[0]
  const ActivePage    = activeItem.component
  const SIDEBAR_W     = collapsed ? 64 : 240

  return (
    <>
      <title>Admin Panel — PDF Master</title>

      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>

        {/* ── Desktop sidebar ──────────────────────────────────────────── */}
        <div
          className="hidden lg:flex flex-col shrink-0 transition-all duration-300"
          style={{ width: SIDEBAR_W }}
        >
          <Sidebar
            active={active}
            setActive={setActive}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
          />
        </div>

        {/* ── Mobile sidebar drawer ────────────────────────────────────── */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
              />
              <motion.div
                className="fixed top-0 left-0 bottom-0 z-50 w-64 lg:hidden"
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              >
                <Sidebar
                  active={active}
                  setActive={setActive}
                  collapsed={false}
                  setCollapsed={() => {}}
                  onClose={() => setMobileOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center gap-3 px-4 sm:px-6 h-16 border-b shrink-0"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" style={{ color: 'var(--text)' }} />
            </button>

            {/* Collapse toggle (desktop) */}
            <button
              onClick={() => setCollapsed(v => !v)}
              className="hidden lg:flex p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              aria-label="Collapse sidebar"
            >
              <Menu className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
              <span style={{ color: 'var(--text-muted)' }}>Admin</span>
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{activeItem.label}</span>
            </div>

            {/* Right: live indicator */}
            <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Suspense fallback={<PageLoader />}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ActivePage />
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </main>
        </div>
      </div>
    </>
  )
}
