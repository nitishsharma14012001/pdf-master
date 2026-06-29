import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Download, CheckCircle2, AlertCircle,
  Loader2, Info, RefreshCw, Zap
} from 'lucide-react'
import { getToolById, colorMap, allTools } from '../../utils/tools'
import FileDropzone from '../ui/FileDropzone'
import ProgressBar from '../ui/ProgressBar'
import AdBanner from '../ui/AdBanner'
import SEO from '../ui/SEO'
import { useFileProcessor } from '../../hooks/useFileProcessor'
import toast from 'react-hot-toast'

// Map file extensions → MIME types accepted by the dropzone
function buildAcceptMap(exts) {
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.bmp': 'image/bmp',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  return exts.reduce((acc, ext) => {
    const mime = mimeMap[ext]
    if (mime) { if (!acc[mime]) acc[mime] = []; acc[mime].push(ext) }
    return acc
  }, {})
}

// ── Per-tool option panels ────────────────────────────────────────────────────
const TOOL_OPTIONS = {
  'compress-pdf': [
    { key: 'quality', label: 'Compression Level', type: 'select', opts: [
      { v: 'low', l: 'Maximum — smallest file' },
      { v: 'medium', l: 'Balanced — recommended' },
      { v: 'high', l: 'Minimal — best quality' },
    ]},
  ],
  'rotate-pdf': [
    { key: 'angle', label: 'Rotation', type: 'select', opts: [
      { v: '90',  l: '90° Clockwise' },
      { v: '-90', l: '90° Counter-clockwise' },
      { v: '180', l: '180°' },
    ]},
    { key: 'pages', label: 'Apply to (leave blank for all)', type: 'text', placeholder: 'e.g. 1,3,5-8' },
  ],
  'protect-pdf': [
    { key: 'password', label: 'Password', type: 'password', placeholder: 'Choose a strong password' },
  ],
  'unlock-pdf': [
    { key: 'password', label: 'Current PDF Password', type: 'password', placeholder: 'Enter the password' },
  ],
  'add-watermark': [
    { key: 'text',    label: 'Watermark Text', type: 'text',   placeholder: 'e.g. CONFIDENTIAL' },
    { key: 'opacity', label: 'Opacity', type: 'select', opts: [
      { v: '25', l: '25% — subtle' },
      { v: '50', l: '50% — moderate' },
      { v: '75', l: '75% — prominent' },
    ]},
    { key: 'angle', label: 'Angle', type: 'select', opts: [
      { v: '45',  l: '45° diagonal' },
      { v: '0',   l: 'Horizontal' },
      { v: '-45', l: '-45° diagonal' },
    ]},
  ],
  'add-page-numbers': [
    { key: 'position', label: 'Position', type: 'select', opts: [
      { v: 'bottom-center', l: 'Bottom Center' },
      { v: 'bottom-right',  l: 'Bottom Right' },
      { v: 'bottom-left',   l: 'Bottom Left' },
      { v: 'top-center',    l: 'Top Center' },
    ]},
    { key: 'start', label: 'Start Numbering From', type: 'number', placeholder: '1' },
    { key: 'prefix', label: 'Prefix (optional)', type: 'text', placeholder: 'e.g. Page ' },
  ],
  'split-pdf': [
    { key: 'mode', label: 'Split Mode', type: 'select', opts: [
      { v: 'all',   l: 'Every page into a separate file' },
      { v: 'range', l: 'Custom page range' },
      { v: 'every', l: 'Every N pages' },
    ]},
    { key: 'range', label: 'Page Range (for custom mode)', type: 'text', placeholder: 'e.g. 1-5, 8, 10-12' },
  ],
  'extract-pages': [
    { key: 'pages', label: 'Pages to Extract', type: 'text', placeholder: 'e.g. 1,3,5-8' },
  ],
  'delete-pages': [
    { key: 'pages', label: 'Pages to Delete', type: 'text', placeholder: 'e.g. 2,4,6-9' },
  ],
  'resize-image': [
    { key: 'width',  label: 'Width (px)',  type: 'number', placeholder: '1920' },
    { key: 'height', label: 'Height (px)', type: 'number', placeholder: '1080' },
    { key: 'fit', label: 'Resize Mode', type: 'select', opts: [
      { v: 'cover',    l: 'Cover (crop to fit)' },
      { v: 'contain',  l: 'Contain (letterbox)' },
      { v: 'fill',     l: 'Stretch to fill' },
      { v: 'inside',   l: 'Shrink only' },
    ]},
  ],
  'compress-image': [
    { key: 'quality', label: 'Target Quality', type: 'select', opts: [
      { v: '50', l: 'Maximum compression (50%)' },
      { v: '70', l: 'Balanced (70%)' },
      { v: '85', l: 'High quality (85%)' },
      { v: '95', l: 'Near-lossless (95%)' },
    ]},
  ],
  'image-quality': [
    { key: 'quality', label: 'Quality (1–100)', type: 'number', placeholder: '80' },
  ],
  'crop-image': [
    { key: 'width',  label: 'Crop Width (px)',  type: 'number', placeholder: '800' },
    { key: 'height', label: 'Crop Height (px)', type: 'number', placeholder: '600' },
    { key: 'left',   label: 'Left Offset (px)', type: 'number', placeholder: '0' },
    { key: 'top',    label: 'Top Offset (px)',  type: 'number', placeholder: '0' },
  ],
  'rotate-image': [
    { key: 'angle', label: 'Rotation Angle', type: 'select', opts: [
      { v: '90',  l: '90° Clockwise' },
      { v: '-90', l: '90° Counter-clockwise' },
      { v: '180', l: '180°' },
    ]},
  ],
  'flip-image': [
    { key: 'direction', label: 'Flip Direction', type: 'select', opts: [
      { v: 'horizontal', l: 'Horizontal (left ↔ right)' },
      { v: 'vertical',   l: 'Vertical (top ↕ bottom)' },
    ]},
  ],
}

function ToolOptions({ toolId, options, setOptions }) {
  const config = TOOL_OPTIONS[toolId]
  if (!config) return null

  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Options</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {config.map(opt => (
          <div key={opt.key}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {opt.label}
            </label>
            {opt.type === 'select' ? (
              <select
                value={options[opt.key] ?? opt.opts[0].v}
                onChange={e => setOptions(o => ({ ...o, [opt.key]: e.target.value }))}
                className="input-field text-sm"
              >
                {opt.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ) : (
              <input
                type={opt.type}
                placeholder={opt.placeholder}
                value={options[opt.key] ?? ''}
                onChange={e => setOptions(o => ({ ...o, [opt.key]: e.target.value }))}
                className="input-field text-sm"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Status panels ─────────────────────────────────────────────────────────────
function ProcessingPanel({ progress }) {
  return (
    <div className="py-10 text-center space-y-6">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full"
        style={{ background: 'rgba(37,99,235,0.1)' }}>
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
      <div>
        <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text)' }}>
          {progress < 50 ? 'Uploading your file…' : 'Processing…'}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {progress < 50 ? 'Secure upload in progress' : 'This usually takes just a few seconds'}
        </p>
      </div>
      <ProgressBar value={progress} label={`${Math.round(progress)}% complete`} className="max-w-sm mx-auto" />
    </div>
  )
}

function DonePanel({ result, onDownload, onReset }) {
  const sizeKB = result?.outputSize ? (result.outputSize / 1024).toFixed(1) : '—'
  return (
    <div className="py-10 text-center space-y-6">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 dark:bg-green-950/30">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>
      <div>
        <p className="font-semibold text-xl mb-1" style={{ color: 'var(--text)' }}>File ready!</p>
        {result?.outputFile && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {result.outputFile} · {sizeKB} KB
            {result.processingMs && ` · processed in ${result.processingMs}ms`}
          </p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onDownload} className="btn-primary px-8 py-3 text-base">
          <Download className="w-4 h-4" />
          Download File
        </button>
        <button onClick={onReset} className="btn-secondary px-8 py-3">
          <RefreshCw className="w-4 h-4" />
          Process Another
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        This file will be permanently deleted in 1 hour.
      </p>
    </div>
  )
}

function ErrorPanel({ error, onReset }) {
  return (
    <div className="py-10 text-center space-y-4">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 dark:bg-red-950/30">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      <p className="font-semibold text-lg" style={{ color: 'var(--text)' }}>Processing failed</p>
      {error && <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>{error}</p>}
      <button onClick={onReset} className="btn-primary">Try Again</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ToolPage() {
  const { toolId } = useParams()
  const tool = getToolById(toolId)
  const [files, setFiles] = useState([])
  const [options, setOptions] = useState({})
  const { process, status, progress, result, error, reset, download } = useFileProcessor()
  const colors = colorMap[tool?.color] || colorMap.blue

  const relatedTools = allTools
    .filter(t => t.color === tool?.color && t.id !== toolId)
    .slice(0, 4)

  const handleProcess = async () => {
    if (files.length === 0) { toast.error('Please upload a file first'); return }
    await process(toolId, files, options)
    if (status !== 'error') toast.success('File processed!')
  }

  if (!tool) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-6xl font-extrabold gradient-text mb-4">404</p>
          <h1 className="text-xl font-bold mb-3" style={{ color: 'var(--text)' }}>Tool not found</h1>
          <Link to="/" className="text-blue-600 hover:underline">← Back to Home</Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <SEO
        title={tool.label}
        description={`${tool.desc}. Free, fast, and secure. No sign-up required.`}
        canonical={`/tools/${tool.id}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: `${tool.label} — PDF Master`,
          applicationCategory: 'Utility',
          operatingSystem: 'Any (web-based)',
          url: `https://pdfmaster.app/tools/${tool.id}`,
          description: tool.desc,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }}
      />

      <div className="min-h-screen pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-6" aria-label="Breadcrumb"
            style={{ color: 'var(--text-muted)' }}>
            <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
            <span aria-hidden>/</span>
            <Link to="/#tools" className="hover:text-blue-600 transition-colors">Tools</Link>
            <span aria-hidden>/</span>
            <span style={{ color: 'var(--text)' }} aria-current="page">{tool.label}</span>
          </nav>

          {/* Header */}
          <div className="mb-8">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold mb-4 ${colors.bg} ${colors.icon}`}>
              {tool.badge && <span className="badge badge-blue text-[10px]">{tool.badge}</span>}
              {tool.label}
            </span>
            <h1 className="font-display text-4xl font-extrabold mb-3" style={{ color: 'var(--text)' }}>
              {tool.label}
            </h1>
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
              {tool.desc}. Free, fast, and secure — no sign-up required.
            </p>
          </div>

          {/* ── Main card ─────────────────────────────────── */}
          <div className="rounded-3xl p-8 mb-6"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px var(--shadow)' }}>

            {status === 'idle' && (
              <div className="space-y-5">
                <FileDropzone
                  accepts={buildAcceptMap(tool.accepts)}
                  multiple={tool.multi}
                  onFilesAccepted={setFiles}
                  description={`Drop your ${tool.accepts.join(', ')} file${tool.multi ? 's' : ''} here`}
                  hint={`${tool.multi ? 'Multiple files accepted' : 'Single file'} · Max 25 MB (free)`}
                />
                <ToolOptions toolId={toolId} options={options} setOptions={setOptions} />
                {files.length > 0 && (
                  <button onClick={handleProcess} className="btn-primary w-full justify-center py-4 text-base">
                    <Zap className="w-4 h-4" />
                    {tool.label} →
                  </button>
                )}
              </div>
            )}

            {(status === 'uploading' || status === 'processing') && (
              <ProcessingPanel progress={progress} />
            )}

            {status === 'done' && (
              <DonePanel
                result={result}
                onDownload={download}
                onReset={() => { reset(); setFiles([]); setOptions({}) }}
              />
            )}

            {status === 'error' && (
              <ErrorPanel
                error={error}
                onReset={() => { reset(); setFiles([]); setOptions({}) }}
              />
            )}
          </div>

          {/* Privacy notice */}
          <div className="flex gap-3 p-4 rounded-xl mb-8"
            style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)' }}>
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Your files are processed on encrypted servers and automatically deleted after 1 hour.
              We never read, analyze, or share your content.
            </p>
          </div>

          {/* Ad */}
          <AdBanner slot="horizontal" className="mb-8" />

          {/* Related tools */}
          {relatedTools.length > 0 && (
            <section>
              <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text)' }}>Related Tools</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {relatedTools.map(rt => (
                  <Link key={rt.id} to={`/tools/${rt.id}`} className="tool-card text-center p-4">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{rt.label}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{rt.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  )
}
