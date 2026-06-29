/**
 * AdminLogs.jsx
 * Log viewer with search, level filter, and tabbed views.
 * Auto-refreshes every 15s.
 */

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, AlertTriangle, Info, Bug, Shield, RefreshCw } from 'lucide-react'
import { useLogs } from '../../../hooks/useAdminData'
import { Card, SectionTitle, CardSkeleton, ErrorState, Badge, fadeUp, G } from './AdminShared'

const LOG_TABS = [
  { key: 'recent',   label: 'Recent',   icon: Info },
  { key: 'errors',   label: 'Errors',   icon: AlertTriangle },
  { key: 'security', label: 'Security', icon: Shield },
]

const LEVEL_COLORS = {
  error: { bg: '#ef444418', color: '#ef4444' },
  warn:  { bg: '#f59e0b18', color: '#f59e0b' },
  info:  { bg: `${G.blue}18`, color: G.blue },
  http:  { bg: `${G.cyan}18`,  color: G.cyan },
  debug: { bg: '#a3a3a318', color: '#a3a3a3' },
}

function LevelBadge({ level }) {
  const style = LEVEL_COLORS[level?.toLowerCase()] || LEVEL_COLORS.info
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
      style={{ background: style.bg, color: style.color }}>
      {level || 'info'}
    </span>
  )
}

function LogRow({ log, last }) {
  const [expanded, setExpanded] = useState(false)
  const { timestamp, level, message, ...meta } = log
  const hasMeta = Object.keys(meta).length > 0

  return (
    <div
      className={`group py-3 px-4 transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer ${!last ? 'border-b' : ''}`}
      style={{ borderColor: 'var(--border)' }}
      onClick={() => hasMeta && setExpanded(v => !v)}
      role="row"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && hasMeta && setExpanded(v => !v)}
      aria-expanded={expanded}
    >
      <div className="flex items-start gap-3">
        {/* Time */}
        <span className="text-[10px] font-mono shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {timestamp ? new Date(timestamp).toLocaleTimeString() : '—'}
        </span>
        {/* Level */}
        <LevelBadge level={level} />
        {/* Message */}
        <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>{message}</span>
        {hasMeta && (
          <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>
      {expanded && hasMeta && (
        <motion.pre
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-2 text-[10px] font-mono overflow-x-auto rounded-lg p-3 ml-24"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
        >
          {JSON.stringify(meta, null, 2)}
        </motion.pre>
      )}
    </div>
  )
}

export default function AdminLogs() {
  const [activeTab, setActiveTab] = useState('recent')
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')

  const { data, loading, error, refetch } = useLogs({
    level: levelFilter !== 'all' ? levelFilter : '',
    search,
    limit: 150,
  })

  const d = data || {}
  const logs = useMemo(() => {
    const raw = activeTab === 'errors'   ? d.errors   || [] :
                activeTab === 'security' ? d.security || [] :
                d.recent || []
    return raw
  }, [activeTab, d])

  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <motion.div
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Logs</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {d.totalLines ? `${d.totalLines.toLocaleString()} total entries` : 'Live log viewer'}
            {!d.logsAvailable && ' — enable file logging in production'}
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          style={{ color: G.blue, border: `1px solid ${G.blue}33` }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Search + filter row */}
      <motion.div variants={fadeUp} custom={0} className="flex flex-wrap gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="search"
            placeholder="Search logs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
            aria-label="Search log entries"
          />
        </div>
        {/* Level filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          {['all', 'info', 'warn', 'error', 'http', 'debug'].map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={levelFilter === lvl
                ? { background: `linear-gradient(135deg, ${G.blue}, ${G.violet})`, color: '#fff' }
                : { color: 'var(--text-muted)' }
              }
            >
              {lvl}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeUp} custom={1} className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {LOG_TABS.map(tab => {
          const count = tab.key === 'recent'   ? (d.recent?.length   || 0) :
                        tab.key === 'errors'   ? (d.errors?.length   || 0) :
                        (d.security?.length   || 0)
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={activeTab === tab.key
                ? { background: `linear-gradient(135deg, ${G.blue}, ${G.violet})`, color: '#fff' }
                : { color: 'var(--text-muted)' }
              }
              aria-selected={activeTab === tab.key}
              role="tab"
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{
                    background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : `${G.blue}20`,
                    color: activeTab === tab.key ? '#fff' : G.blue,
                  }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </motion.div>

      {/* Log table */}
      <motion.div variants={fadeUp} custom={2}>
        <Card noPad>
          {!d.logsAvailable && activeTab !== 'security' ? (
            <div className="py-16 text-center">
              <Bug className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Log files not available</p>
              <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
                Set <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-secondary)' }}>NODE_ENV=production</code>
                {' '}to enable file logging via Winston.
              </p>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <Info className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {search ? `No logs matching "${search}"` : 'No log entries in this category.'}
              </p>
            </div>
          ) : (
            <div role="table" aria-label="Log entries">
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b text-[10px] font-bold uppercase tracking-wider"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                <span className="w-16">Time</span>
                <span className="w-14">Level</span>
                <span className="flex-1">Message</span>
              </div>
              {logs.map((log, i) => (
                <LogRow key={i} log={log} last={i === logs.length - 1} />
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}
