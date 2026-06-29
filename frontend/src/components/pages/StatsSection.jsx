import { useState, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FileStack, Users, Globe2, Activity } from 'lucide-react'
import FadeIn from '../ui/FadeIn'

const STATS = [
  { icon: FileStack, value: 50_000_000, suffix: '+', display: '50M+', label: 'Files Processed' },
  { icon: Users, value: 2_000_000, suffix: '+', display: '2M+', label: 'Active Users' },
  { icon: Globe2, value: 120, suffix: '+', display: '120+', label: 'Countries Served' },
  { icon: Activity, value: 99.9, suffix: '%', display: '99.9%', label: 'Uptime' },
]

/** Counts up from 0 to `target` once it scrolls into view, then holds the final formatted display string. */
function CountUp({ target, display, duration = 1.4 }) {
  const [value, setValue] = useState(0)
  const [done, setDone] = useState(false)
  const startedRef = useRef(false)
  const reduceMotion = useReducedMotion()

  const start = () => {
    if (startedRef.current) return
    startedRef.current = true

    if (reduceMotion) {
      setValue(target)
      setDone(true)
      return
    }

    const startTime = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) {
        requestAnimationFrame(tick)
      } else {
        setDone(true)
      }
    }
    requestAnimationFrame(tick)
  }

  if (done) return <>{display}</>

  let formatted
  if (target >= 1_000_000) {
    formatted = `${(value / 1_000_000).toFixed(1)}M+`
  } else if (target % 1 !== 0) {
    formatted = value.toFixed(1) + '%'
  } else {
    formatted = `${Math.round(value)}+`
  }

  return (
    <motion.span onViewportEnter={start} viewport={{ once: true }}>
      {formatted}
    </motion.span>
  )
}

export default function StatsSection() {
  return (
    <section className="py-16 px-4" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map((s, i) => (
          <FadeIn key={s.label} delay={i * 0.08} className="text-center">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
              style={{ background: 'rgba(37,99,235,0.1)' }}
            >
              <s.icon className="w-5 h-5 text-blue-600" aria-hidden="true" />
            </div>
            <p className="font-display text-3xl font-extrabold gradient-text">
              <CountUp target={s.value} display={s.display} />
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {s.label}
            </p>
          </FadeIn>
        ))}
      </div>
    </section>
  )
}
