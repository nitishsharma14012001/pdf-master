/**
 * AdminAnalytics.jsx
 * Tool usage charts, daily activity, file type distribution, top conversions.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import { useAnalytics } from '../../../hooks/useAdminData'
import {
  Card, SectionTitle, ProgressBar, CardSkeleton,
  ErrorState, RefreshButton, fadeUp, G,
} from './AdminShared'

const PIE_COLORS = [G.blue, G.violet, G.cyan, '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-3 text-xs shadow-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color || G.blue }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  )
}

const PERIODS = [
  { label: '24h',  value: '24h' },
  { label: '7d',   value: '7d'  },
  { label: '30d',  value: '30d' },
]

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('7d')
  const { data, loading, error, refetch } = useAnalytics(period)

  if (error) return <ErrorState message={error} onRetry={refetch} />

  const d           = data || {}
  const series      = d.dailySeries      || []
  const toolUsage   = (d.toolUsage       || []).slice(0, 12)
  const fileTypes   = d.fileTypeDistribution || []
  const maxToolCount = toolUsage[0]?.count || 1

  // Split tools into PDF and Image groups for the bar chart
  const pdfTools = toolUsage.filter(t => t.tool.includes('pdf') || t.tool.includes('pages') || t.tool.includes('watermark'))
  const imgTools = toolUsage.filter(t => !t.tool.includes('pdf') && !t.tool.includes('pages') && !t.tool.includes('watermark'))

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
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Analytics</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Tool usage, activity trends, file types
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={period === p.value
                  ? { background: `linear-gradient(135deg, ${G.blue}, ${G.violet})`, color: '#fff' }
                  : { color: 'var(--text-muted)' }
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <RefreshButton onClick={refetch} loading={loading} />
        </div>
      </div>

      {/* Daily activity area chart */}
      <motion.div variants={fadeUp} custom={0}>
        <Card>
          <SectionTitle>Daily Activity — Files Processed</SectionTitle>
          {loading ? (
            <div className="h-64 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={G.blue}   stopOpacity={0.3} />
                    <stop offset="100%" stopColor={G.violet} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="filesProcessed" name="Files"
                  stroke={G.blue} strokeWidth={2} fill="url(#areaGrad)" dot={false} />
                <Area type="monotone" dataKey="errors" name="Errors"
                  stroke="#ef4444" strokeWidth={1.5} fill="url(#errGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>

      {/* Downloads line chart */}
      <motion.div variants={fadeUp} custom={1}>
        <Card>
          <SectionTitle>Downloads Over Time</SectionTitle>
          {loading ? (
            <div className="h-48 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="downloads" name="Downloads"
                  stroke={G.cyan} strokeWidth={2} dot={{ r: 3, fill: G.cyan }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>

      {/* Tool usage + file types */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Most used tools — bar chart */}
        <motion.div variants={fadeUp} custom={2} className="lg:col-span-2">
          <Card>
            <SectionTitle>Most Used Tools</SectionTitle>
            {loading ? (
              <div className="h-56 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
            ) : toolUsage.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>No tool usage recorded yet — start processing files!</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={toolUsage.slice(0, 8).map(t => ({
                    name: t.tool.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
                    count: t.count,
                  }))}
                  margin={{ left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis type="category" dataKey="name" width={110}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Uses" radius={[0,6,6,0]} barSize={14}>
                    {toolUsage.slice(0,8).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </motion.div>

        {/* File type distribution pie */}
        <motion.div variants={fadeUp} custom={3}>
          <Card>
            <SectionTitle>File Types</SectionTitle>
            {loading ? (
              <div className="h-56 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
            ) : fileTypes.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>No files yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={fileTypes} dataKey="count" nameKey="ext"
                    cx="50%" cy="45%" outerRadius={70} strokeWidth={0}>
                    {fileTypes.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
                  <Legend iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: 10, color: 'var(--text-muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Tool usage progress bars */}
      <motion.div variants={fadeUp} custom={4}>
        <Card>
          <SectionTitle>Top Conversions Detail</SectionTitle>
          {loading ? (
            <div className="space-y-3">{Array.from({length:6}).map((_,i)=>(
              <div key={i} className="h-8 rounded animate-pulse" style={{background:'var(--border)'}}/>
            ))}</div>
          ) : toolUsage.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{color:'var(--text-muted)'}}>Start processing files to see usage data.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              {toolUsage.map((t, i) => (
                <div key={t.tool}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium truncate" style={{ color: 'var(--text)' }}>
                      {t.tool.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{t.count.toLocaleString()}</span>
                  </div>
                  <ProgressBar value={(t.count / maxToolCount) * 100} color={PIE_COLORS[i % PIE_COLORS.length]} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}
