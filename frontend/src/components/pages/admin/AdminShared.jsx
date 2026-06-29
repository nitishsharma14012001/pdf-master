/**
 * AdminShared.jsx
 * Re-usable presentational components for the Admin Panel.
 * Imported by every admin sub-page — no prop drilling required.
 */

import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const G = { blue: '#2563eb', violet: '#7c3aed', cyan: '#0ea5e9' }

// ── Fade-up variant ───────────────────────────────────────────────────────────
export const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 },
  }),
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', style = {}, noPad = false }) {
  return (
    <div
      className={`rounded-2xl ${noPad ? '' : 'p-6'} ${className}`}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 1px 4px var(--shadow)', ...style }}
    >
      {children}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, sub, color = G.blue, index = 0 }) {
  return (
    <motion.div variants={fadeUp} custom={index}>
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          {sub && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              sub.startsWith('+') ? 'text-green-600 bg-green-50 dark:bg-green-950/30' :
              sub.startsWith('-') ? 'text-red-500 bg-red-50 dark:bg-red-950/30' :
              'text-blue-600 bg-blue-50 dark:bg-blue-950/30'
            }`}>{sub}</span>
          )}
        </div>
        <p className="text-2xl font-extrabold mb-1 tabular-nums" style={{ color: 'var(--text)' }}>{value ?? '—'}</p>
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </Card>
    </motion.div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
export function SectionTitle({ children }) {
  return (
    <h3 className="font-bold text-base mb-5" style={{ color: 'var(--text)' }}>{children}</h3>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, color = G.blue, className = '' }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div className={`w-full h-2 rounded-full overflow-hidden ${className}`} style={{ background: 'var(--border)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${G.violet})` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`rounded-lg animate-pulse ${className}`} style={{ background: 'var(--border)' }} />
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <Card>
      <Skeleton className="h-5 w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 mb-2 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </Card>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }) {
  return (
    <Card className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
      <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Failed to load data</p>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: `linear-gradient(135deg, ${G.blue}, ${G.violet})` }}
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      )}
    </Card>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color = G.blue }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color }}>
      {children}
    </span>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider() {
  return <div className="w-full h-px my-4" style={{ background: 'var(--border)' }} />
}

// ── Data row ─────────────────────────────────────────────────────────────────
export function DataRow({ label, value, mono = false, last = false }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${!last ? 'border-b' : ''}`}
      style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

// ── Refresh button ────────────────────────────────────────────────────────────
export function RefreshButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50"
      style={{ color: G.blue, border: `1px solid ${G.blue}33` }}
      aria-label="Refresh data"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  )
}

export { G }
