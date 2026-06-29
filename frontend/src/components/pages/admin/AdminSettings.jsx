/**
 * AdminSettings.jsx
 * Manage server settings: upload limits, cleanup interval,
 * maintenance mode, rate limits. Saves via PUT /api/admin/settings.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, Trash2, AlertTriangle, CheckCircle2, Settings } from 'lucide-react'
import { useSettings, saveSettings, triggerCleanup } from '../../../hooks/useAdminData'
import { Card, SectionTitle, CardSkeleton, ErrorState, fadeUp, G } from './AdminShared'

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-12 h-6 rounded-full transition-all duration-300 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ background: checked ? `linear-gradient(135deg, ${G.blue}, ${G.violet})` : 'var(--border)' }}
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300"
          style={{ left: checked ? '26px' : '4px' }}
        />
      </button>
    </div>
  )
}

function NumberInput({ label, description, value, onChange, min, max, suffix }) {
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</p>
          {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number"
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            min={min}
            max={max}
            className="w-24 px-3 py-1.5 rounded-xl text-sm text-right outline-none transition-all"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          {suffix && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
        </div>
      </div>
    </div>
  )
}

export default function AdminSettings() {
  const { data, loading, error, refetch } = useSettings()
  const [form, setForm]       = useState(null)
  const [saving, setSaving]   = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [toast, setToast]     = useState(null)

  useEffect(() => {
    if (data && !form) setForm({ ...data })
  }, [data])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      await saveSettings(form)
      showToast('Settings saved successfully')
      refetch()
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCleanup = async () => {
    setCleaning(true)
    try {
      await triggerCleanup()
      showToast('File cleanup triggered — old uploads deleted')
    } catch (err) {
      showToast('Cleanup failed: ' + err.message, 'error')
    } finally {
      setCleaning(false)
    }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <motion.div
      variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Settings</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Server configuration and maintenance controls
          </p>
        </div>
        <motion.button
          onClick={handleSave}
          disabled={saving || !form}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
          style={{ background: `linear-gradient(135deg, ${G.blue}, ${G.violet})` }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          aria-label="Save settings"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </motion.button>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{
            background: toast.type === 'error' ? '#ef444418' : '#10b98118',
            border: `1px solid ${toast.type === 'error' ? '#ef444433' : '#10b98133'}`,
          }}
        >
          {toast.type === 'error'
            ? <AlertTriangle className="w-5 h-5 text-red-500" />
            : <CheckCircle2 className="w-5 h-5 text-green-500" />}
          <p className="text-sm font-medium" style={{ color: toast.type === 'error' ? '#ef4444' : '#10b981' }}>
            {toast.msg}
          </p>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upload limits */}
        <motion.div variants={fadeUp} custom={0}>
          <Card>
            <SectionTitle>Upload Limits</SectionTitle>
            {loading || !form ? <CardSkeleton lines={4} /> : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                <NumberInput
                  label="Free Plan Limit"
                  description="Maximum upload size for free users"
                  value={form.maxFileSizeMbFree}
                  onChange={v => set('maxFileSizeMbFree', v)}
                  min={1} max={500} suffix="MB"
                />
                <NumberInput
                  label="Pro Plan Limit"
                  description="Maximum upload size for pro users"
                  value={form.maxFileSizeMbPro}
                  onChange={v => set('maxFileSizeMbPro', v)}
                  min={1} max={2000} suffix="MB"
                />
              </div>
            )}
          </Card>
        </motion.div>

        {/* Cleanup */}
        <motion.div variants={fadeUp} custom={1}>
          <Card>
            <SectionTitle>File Cleanup</SectionTitle>
            {loading || !form ? <CardSkeleton lines={3} /> : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                <NumberInput
                  label="File TTL"
                  description="Delete uploaded files after this many hours"
                  value={form.fileTtlHours}
                  onChange={v => set('fileTtlHours', v)}
                  min={1} max={72} suffix="hours"
                />
                <NumberInput
                  label="Cleanup Interval"
                  description="How often the cleanup scheduler runs"
                  value={form.cleanupIntervalMins}
                  onChange={v => set('cleanupIntervalMins', v)}
                  min={5} max={1440} suffix="min"
                />
              </div>
            )}
          </Card>
        </motion.div>

        {/* Rate limiting */}
        <motion.div variants={fadeUp} custom={2}>
          <Card>
            <SectionTitle>Rate Limiting</SectionTitle>
            {loading || !form ? <CardSkeleton lines={4} /> : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                <NumberInput
                  label="Window"
                  description="Rate limit rolling window"
                  value={Math.round((form.rateLimitWindowMs || 900000) / 60000)}
                  onChange={v => set('rateLimitWindowMs', v * 60000)}
                  min={1} max={60} suffix="min"
                />
                <NumberInput
                  label="Free limit"
                  description="Requests per window for free users"
                  value={form.rateLimitMaxFree}
                  onChange={v => set('rateLimitMaxFree', v)}
                  min={1} max={500} suffix="req"
                />
                <NumberInput
                  label="Pro limit"
                  description="Requests per window for pro users"
                  value={form.rateLimitMaxPro}
                  onChange={v => set('rateLimitMaxPro', v)}
                  min={1} max={2000} suffix="req"
                />
              </div>
            )}
          </Card>
        </motion.div>

        {/* Maintenance */}
        <motion.div variants={fadeUp} custom={3}>
          <Card>
            <SectionTitle>Maintenance</SectionTitle>
            {loading || !form ? <CardSkeleton lines={3} /> : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                <Toggle
                  label="Maintenance Mode"
                  description="Block all tool processing and show a maintenance page"
                  checked={form.maintenanceMode}
                  onChange={v => set('maintenanceMode', v)}
                />
              </div>
            )}

            {/* Danger zone */}
            <div className="mt-6 p-4 rounded-xl" style={{ background: '#ef444410', border: '1px solid #ef444430' }}>
              <p className="text-sm font-semibold text-red-500 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Immediately delete all files in the upload directory older than the TTL.
              </p>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-500 transition-all hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                style={{ border: '1px solid #ef444444' }}
              >
                <Trash2 className="w-4 h-4" />
                {cleaning ? 'Running cleanup…' : 'Run Cleanup Now'}
              </button>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Current environment variables */}
      <motion.div variants={fadeUp} custom={4}>
        <Card>
          <SectionTitle>Environment</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'NODE_ENV',       value: 'development' },
              { label: 'PORT',           value: '5000' },
              { label: 'UPLOAD_DIR',     value: './uploads' },
              { label: 'FILE_TTL_HOURS', value: String(form?.fileTtlHours ?? 1) },
              { label: 'MAX_FILE_FREE',  value: `${form?.maxFileSizeMbFree ?? 25} MB` },
              { label: 'MAX_FILE_PRO',   value: `${form?.maxFileSizeMbPro ?? 200} MB` },
            ].map(e => (
              <div key={e.label} className="px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{e.label}</p>
                <p className="text-sm font-mono font-semibold" style={{ color: 'var(--text)' }}>{e.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
