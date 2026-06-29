import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, UploadCloud, CheckCircle2 } from 'lucide-react'
import RippleButton from '../ui/RippleButton'
import { track } from '../../analytics'

const SHAPES = [
  { kind: 'circle',  top: '12%', left: '7%',  size: 64, duration: 9,  delay: 0,   hue: 'from-blue-400/30 to-blue-600/10'   },
  { kind: 'square',  top: '68%', left: '10%', size: 46, duration: 11, delay: 0.6, hue: 'from-indigo-400/25 to-blue-500/10' },
  { kind: 'hexagon', top: '20%', left: '88%', size: 70, duration: 10, delay: 0.3, hue: 'from-sky-400/30 to-blue-600/10'    },
  { kind: 'triangle',top: '72%', left: '90%', size: 50, duration: 8,  delay: 1,   hue: 'from-blue-300/30 to-indigo-500/10' },
  { kind: 'circle',  top: '85%', left: '45%', size: 34, duration: 7,  delay: 1.4, hue: 'from-blue-400/20 to-sky-500/10'    },
  { kind: 'square',  top: '8%',  left: '46%', size: 28, duration: 12, delay: 0.8, hue: 'from-indigo-300/25 to-blue-400/10' },
]

function GeometricShape({ kind, size, hue, className = '' }) {
  const base = `bg-gradient-to-br ${hue} backdrop-blur-sm`
  if (kind === 'circle') {
    return <div className={`rounded-full ${base} ${className}`} style={{ width: size, height: size }} />
  }
  if (kind === 'square') {
    return <div className={`rounded-lg rotate-45 ${base} ${className}`} style={{ width: size, height: size }} />
  }
  if (kind === 'triangle') {
    return (
      <div
        className={className}
        style={{
          width: 0, height: 0,
          borderLeft:  `${size / 2}px solid transparent`,
          borderRight: `${size / 2}px solid transparent`,
          borderBottom:`${size}px solid rgba(96,165,250,0.22)`,
          filter: 'blur(0.5px)',
        }}
      />
    )
  }
  return (
    <div
      className={`${base} ${className}`}
      style={{ width: size, height: size * 0.86, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
    />
  )
}

export default function Hero({ scrollTargetId = 'tools' }) {
  const navigate      = useNavigate()
  const fileInputRef  = useRef(null)
  const reduceMotion  = useReducedMotion()
  const [pulse, setPulse] = useState(false)

  const handleSelectFiles = () => {
    track.selectFiles({ location: 'hero' })
    fileInputRef.current?.click()
  }

  const routeForFile = (file) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf')               return '/tools/merge-pdf'
    if (ext === 'png')               return '/tools/png-to-pdf'
    if (ext === 'webp')              return '/tools/webp-to-pdf'
    if (ext === 'jpg' || ext === 'jpeg') return '/tools/jpg-to-pdf'
    return '/tools/merge-pdf'
  }

  const handleFilesChosen = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

    // Fire upload-started at the moment the user confirms their file selection
    track.fileUploadStarted({
      toolId:     routeForFile(files[0]).replace('/tools/', ''),
      fileCount:  files.length,
      totalBytes,
    })

    setPulse(true)
    navigate(routeForFile(files[0]), { state: { initialFiles: files } })
  }

  const scrollToTools = () => {
    track.exploreTools({ location: 'hero' })
    document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Animated gradient backdrop */}
      <div
        className="absolute inset-0 animate-gradient"
        style={{
          background: 'linear-gradient(120deg, rgba(37,99,235,0.16), rgba(99,102,241,0.10), rgba(14,165,233,0.14), rgba(37,99,235,0.16))',
          backgroundSize: '300% 300%',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 100% 90%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Floating geometric shapes */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block" aria-hidden="true">
        {SHAPES.map((s, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ top: s.top, left: s.left }}
            animate={reduceMotion ? {} : { y: [0, -22, 0], rotate: [0, 8, 0] }}
            transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
          >
            <GeometricShape kind={s.kind} size={s.size} hue={s.hue} />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
          style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: '#2563eb' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          No sign-up needed for any tool
        </motion.div>

        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6"
          style={{ color: 'var(--text)' }}
        >
          Every PDF &amp; Image Tool
          <br />
          <span className="gradient-text">You Need</span>
        </motion.h1>

        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          Convert, Merge, Split, Compress and Edit files securely in your browser.
        </motion.p>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={handleFilesChosen}
            aria-hidden="true"
            tabIndex={-1}
          />
          <RippleButton
            onClick={handleSelectFiles}
            className="btn-primary text-base py-3.5 px-7"
            aria-label="Select files to process"
          >
            <UploadCloud className="w-4.5 h-4.5" />
            Select Files
          </RippleButton>
          <RippleButton
            onClick={scrollToTools}
            className="btn-secondary text-base py-3.5 px-7"
            aria-label="Explore all tools"
          >
            Explore Tools
            <ArrowRight className="w-4 h-4" />
          </RippleButton>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-wrap justify-center gap-6 mt-12 text-xs font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          {['Files processed locally & deleted after', 'AES-256 encrypted in transit', 'No watermarks, ever'].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
