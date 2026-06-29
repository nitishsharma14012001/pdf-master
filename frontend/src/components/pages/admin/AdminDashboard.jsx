/**
 * AdminDashboard.jsx
 * Main dashboard: KPI cards + top tools bar chart + memory gauge.
 */

import { motion } from 'framer-motion'
import {
  FileText, Download, Zap, Shield, HardDrive,
  Clock, TrendingUp, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useDashboard, useAnalytics } from '../../../hooks/useAdminData'
import {
  Card, StatCard, SectionTitle, ProgressBar,
  CardSkeleton, ErrorState, RefreshButton, fadeUp, G,
} from './AdminShared'

function formatBytes(b) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`
  return `${b} B`
}

function formatUptime(secs) {
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const PIE_COLORS = [G.blue, G.violet, G.cyan, '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-3 text-xs shadow-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const { data, loading, error, refetch } = useDashboard()
  const { data: analytics, loading: aLoading } = useAnalytics('7d')

  if (error) return <ErrorState message={error} onRetry={refetch} />

  const d    = data    || {}
  const a    = analytics || {}
  const mem  = d.memory || {}
  const topTools = (a.toolUsage || []).slice(0, 8)
  const maxCount = topTools[0]?.count || 1
  const fileTypes = a.fileTypeDistribution || []
  const series    = (a.dailySeries || []).slice(-7)

  return (
    <motion.div
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Dashboard</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Live metrics · auto-refreshes every 30s
          </p>
        </div>
        <RefreshButton onClick={refetch} loading={loading} />
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} lines={2} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText}     label="Processed Today"    value={d.filesProcessedToday?.toLocaleString() ?? '0'} color={G.blue}   index={0} />
          <StatCard icon={TrendingUp}   label="Total Processed"    value={d.totalProcessed?.toLocaleString()      ?? '0'} color={G.violet} index={1} />
          <StatCard icon={Download}     label="Active Jobs"        value={d.activeJobs?.toLocaleString()          ?? '0'} color={G.cyan}   index={2} />
          <StatCard icon={CheckCircle2} label="Success Rate"       value={`${d.successRate ?? 100}%`}                    color="#10b981"  index={3} />
          <StatCard icon={Clock}        label="Avg Process Time"   value={d.avgProcessingMs ? `${d.avgProcessingMs}ms` : 'N/A'} color="#f59e0b" index={4} />
          <StatCard icon={HardDrive}    label="Storage Used"       value={d.storageUsed ?? '0 B'}                        color="#6366f1"  index={5} />
          <StatCard icon={AlertTriangle} label="Errors Today"      value={d.errorsToday?.toLocaleString() ?? '0'} color="#ef4444" index={6} />
          <StatCard icon={Zap}          label="Server Uptime"      value={d.uptimeSeconds ? formatUptime(d.uptimeSeconds) : '—'} color="#14b8a6" index={7} />
        </div>
      )}

      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Daily activity */}
        <motion.div variants={fadeUp} custom={4} className="lg:col-span-2">
          <Card>
            <SectionTitle>Files Processed — Last 7 Days</SectionTitle>
            {aLoading ? <div className="h-52 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading chart…</div> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={series} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="filesProcessed" name="Files" radius={[6,6,0,0]}
                    fill="url(#barGrad)" />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={G.blue} />
                      <stop offset="100%" stopColor={G.violet} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </motion.div>

        {/* File type pie */}
        <motion.div variants={fadeUp} custom={5}>
          <Card>
            <SectionTitle>File Types</SectionTitle>
            {aLoading || !fileTypes.length ? (
              <div className="h-52 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {aLoading ? 'Loading…' : 'No data yet'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={fileTypes} dataKey="count" nameKey="ext" cx="50%" cy="50%"
                    outerRadius={70} strokeWidth={0}>
                    {fileTypes.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
                  <Legend iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Bottom row ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top tools */}
        <motion.div variants={fadeUp} custom={6}>
          <Card>
            <SectionTitle>Most Used Tools (this session)</SectionTitle>
            {aLoading ? (
              <div className="space-y-3">{Array.from({length:5}).map((_,i)=>(
                <div key={i} className="h-8 rounded animate-pulse" style={{background:'var(--border)'}} />
              ))}</div>
            ) : topTools.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No tool usage recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {topTools.map((t, i) => (
                  <div key={t.tool}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium" style={{ color: 'var(--text)' }}>
                        {String(i+1).padStart(2,'0')}. {t.tool.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{t.count.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={(t.count / maxCount) * 100} color={PIE_COLORS[i % PIE_COLORS.length]} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Memory gauge */}
        <motion.div variants={fadeUp} custom={7}>
          <Card>
            <SectionTitle>System Memory</SectionTitle>
            {loading ? (
              <CardSkeleton lines={4} />
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-muted)' }}>OS Memory</span>
                    <span style={{ color: 'var(--text)' }}>{mem.osUsedMb ?? 0} / {mem.osTotalMb ?? 0} MB</span>
                  </div>
                  <ProgressBar value={mem.osPercentUsed ?? 0} color={
                    mem.osPercentUsed > 85 ? '#ef4444' :
                    mem.osPercentUsed > 65 ? '#f59e0b' : G.blue
                  } />
                  <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
                    {mem.osPercentUsed ?? 0}% used
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-muted)' }}>Heap Used</span>
                    <span style={{ color: 'var(--text)' }}>
                      {mem.heapUsedMb ?? 0} / {mem.heapTotalMb ?? 0} MB
                    </span>
                  </div>
                  <ProgressBar
                    value={mem.heapTotalMb ? (mem.heapUsedMb / mem.heapTotalMb) * 100 : 0}
                    color={G.violet}
                  />
                </div>
                <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                  {[
                    { label: 'RSS',      value: `${mem.rssMb ?? 0} MB` },
                    { label: 'Free OS',  value: `${mem.osFreeMb ?? 0} MB` },
                    { label: 'Uptime',   value: d.uptimeSeconds ? formatUptime(d.uptimeSeconds) : '—' },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                      <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
