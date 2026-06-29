/**
 * AdminServer.jsx
 * Live server metrics: uptime, Node version, memory, CPU, disk, environment.
 * Auto-refreshes every 10 seconds.
 */

import { motion } from 'framer-motion'
import { Server, Cpu, HardDrive, Layers, Globe, RefreshCw, CheckCircle2 } from 'lucide-react'
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { useServer } from '../../../hooks/useAdminData'
import { Card, SectionTitle, ProgressBar, DataRow, CardSkeleton, ErrorState, fadeUp, G } from './AdminShared'

function formatUptime(secs) {
  if (!secs) return '—'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ')
}

function GaugeCard({ title, percent, label, color, icon: Icon, index }) {
  const safePercent = Math.min(100, Math.max(0, percent || 0))
  const statusColor = safePercent > 85 ? '#ef4444' : safePercent > 65 ? '#f59e0b' : '#10b981'

  return (
    <motion.div variants={fadeUp} custom={index}>
      <Card className="flex flex-col items-center text-center py-6">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: `${color}18` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{title}</p>

        {/* Radial gauge */}
        <div className="relative w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%" cy="50%"
              innerRadius="70%" outerRadius="100%"
              startAngle={225} endAngle={-45}
              data={[{ value: safePercent }]}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                background={{ fill: 'var(--border)' }}
                dataKey="value"
                fill={statusColor}
                cornerRadius={6}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold tabular-nums" style={{ color: statusColor }}>
              {safePercent}%
            </span>
          </div>
        </div>

        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </Card>
    </motion.div>
  )
}

export default function AdminServer() {
  const { data, loading, error, refetch } = useServer()

  if (error) return <ErrorState message={error} onRetry={refetch} />

  const d   = data   || {}
  const mem = d.memory || {}
  const cpu = d.cpu  || {}
  const node = d.node || {}
  const osInfo = d.os || {}
  const disk = d.disk || {}

  return (
    <motion.div
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Server</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Live metrics · auto-refreshes every 10s
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

      {/* Status banner */}
      <motion.div variants={fadeUp} custom={0}>
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{ background: '#10b98118', border: '1px solid #10b98133' }}>
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-sm font-semibold text-green-600">Server Operational</p>
            <p className="text-xs text-green-600/70">
              Uptime: {loading ? '—' : formatUptime(d.uptime?.seconds)}
              {' · '}{node.env || 'development'} mode
            </p>
          </div>
        </div>
      </motion.div>

      {/* Gauge cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({length:4}).map((_,i)=>(
          <CardSkeleton key={i} lines={2} />
        )) : (
          <>
            <GaugeCard
              title="OS Memory" icon={Layers}
              percent={mem.osPercentUsed}
              label={`${mem.osUsedMb ?? 0} / ${mem.osTotalMb ?? 0} MB`}
              color={G.blue} index={0}
            />
            <GaugeCard
              title="Heap Used" icon={Server}
              percent={mem.heapTotalMb ? Math.round((mem.heapUsedMb / mem.heapTotalMb) * 100) : 0}
              label={`${mem.heapUsedMb ?? 0} / ${mem.heapTotalMb ?? 0} MB`}
              color={G.violet} index={1}
            />
            <GaugeCard
              title="CPU" icon={Cpu}
              percent={cpu.percent}
              label={`${cpu.cores ?? 1} core${cpu.cores !== 1 ? 's' : ''} · ${cpu.loadAvg1 ?? 0} load`}
              color={G.cyan} index={2}
            />
            <GaugeCard
              title="Upload Dir" icon={HardDrive}
              percent={0} /* no total disk via pure Node — show size instead */
              label={disk.uploadDirUsed || '0 B'}
              color="#f59e0b" index={3}
            />
          </>
        )}
      </div>

      {/* Detail cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Node.js info */}
        <motion.div variants={fadeUp} custom={4}>
          <Card>
            <SectionTitle>Node.js Process</SectionTitle>
            {loading ? <CardSkeleton lines={5} /> : (
              <>
                <DataRow label="Version"   value={node.version  || '—'} mono />
                <DataRow label="Platform"  value={node.platform || '—'} mono />
                <DataRow label="Arch"      value={node.arch     || '—'} mono />
                <DataRow label="PID"       value={node.pid      || '—'} mono />
                <DataRow label="Env"       value={node.env      || 'development'} mono />
                <DataRow label="Uptime"    value={formatUptime(d.uptime?.seconds)} last />
              </>
            )}
          </Card>
        </motion.div>

        {/* OS info */}
        <motion.div variants={fadeUp} custom={5}>
          <Card>
            <SectionTitle>Operating System</SectionTitle>
            {loading ? <CardSkeleton lines={5} /> : (
              <>
                <DataRow label="Type"      value={osInfo.type    || '—'} mono />
                <DataRow label="Release"   value={osInfo.release || '—'} mono />
                <DataRow label="Hostname"  value={osInfo.hostname || '—'} mono />
                <DataRow label="CPU Model" value={cpu.model || '—'} mono />
                <DataRow label="Cores"     value={String(cpu.cores ?? '—')} mono />
                <DataRow label="Load (1m)" value={String(cpu.loadAvg1 ?? '—')} last mono />
              </>
            )}
          </Card>
        </motion.div>

        {/* Memory detail */}
        <motion.div variants={fadeUp} custom={6}>
          <Card>
            <SectionTitle>Memory Detail</SectionTitle>
            {loading ? <CardSkeleton lines={6} /> : (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-muted)' }}>OS memory usage</span>
                    <span style={{ color: 'var(--text)' }}>{mem.osPercentUsed ?? 0}%</span>
                  </div>
                  <ProgressBar value={mem.osPercentUsed} color={G.blue} />
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-muted)' }}>Heap usage</span>
                    <span style={{ color: 'var(--text)' }}>
                      {mem.heapTotalMb ? Math.round((mem.heapUsedMb / mem.heapTotalMb) * 100) : 0}%
                    </span>
                  </div>
                  <ProgressBar
                    value={mem.heapTotalMb ? (mem.heapUsedMb / mem.heapTotalMb) * 100 : 0}
                    color={G.violet}
                  />
                </div>
                <DataRow label="RSS"        value={`${mem.rssMb ?? 0} MB`} />
                <DataRow label="Heap Used"  value={`${mem.heapUsedMb ?? 0} MB`} />
                <DataRow label="Heap Total" value={`${mem.heapTotalMb ?? 0} MB`} />
                <DataRow label="OS Free"    value={`${mem.osFreeMb ?? 0} MB`} last />
              </>
            )}
          </Card>
        </motion.div>

        {/* Upload directory */}
        <motion.div variants={fadeUp} custom={7}>
          <Card>
            <SectionTitle>Upload Directory</SectionTitle>
            {loading ? <CardSkeleton lines={3} /> : (
              <>
                <DataRow label="Path"        value={process.env.UPLOAD_DIR || './uploads'} mono />
                <DataRow label="Total used"  value={disk.uploadDirUsed || '0 B'} />
                <DataRow label="Environment" value={node.env || 'development'} last />
              </>
            )}
            <div className="mt-4 p-3 rounded-xl text-xs" style={{ background: 'var(--bg-secondary)' }}>
              <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Auto-cleanup</p>
              <p style={{ color: 'var(--text-muted)' }}>
                Files older than <strong>{process.env.FILE_TTL_HOURS || 1}h</strong> are
                deleted automatically every 30 minutes.
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
