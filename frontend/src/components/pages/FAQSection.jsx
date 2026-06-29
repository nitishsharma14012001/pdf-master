import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import FadeIn from '../ui/FadeIn'

const FAQS = [
  {
    q: 'Is PDF Master really free?',
    a: 'Yes — every PDF and image tool on this site is free to use, with no hidden fees and no watermarks on your output files.',
  },
  {
    q: 'Are my files secure?',
    a: 'Uploads are sent over an encrypted connection and are automatically deleted from our servers shortly after processing completes. We never read or share the contents of your files.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No. Every tool works immediately — pick a tool, upload your file, and download the result.',
  },
  {
    q: 'What file size limits apply?',
    a: 'Free use supports files up to 25 MB. Larger limits are available for accounts on a paid plan.',
  },
  {
    q: 'What browsers are supported?',
    a: 'PDF Master works in all modern browsers, including Chrome, Firefox, Safari, and Edge, on both desktop and mobile.',
  },
]

function FAQItem({ q, a, index }) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const panelId = `faq-panel-${index}`

  return (
    <div className="rounded-2xl overflow-hidden glass-card">
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left font-semibold text-sm transition-colors hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        style={{ color: 'var(--text)' }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span>{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.25 }}>
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-blue-600" aria-hidden="true" />
        </motion.span>
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          className="px-6 pb-5 text-sm leading-relaxed"
          style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
        >
          <div className="pt-4">{a}</div>
        </div>
      )}
    </div>
  )
}

export default function FAQSection() {
  return (
    <section className="section" style={{ background: 'var(--bg-secondary)' }}>
      <div className="container-main max-w-3xl">
        <FadeIn className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>
            Frequently asked <span className="gradient-text">questions</span>
          </h2>
        </FadeIn>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <FadeIn key={f.q} delay={i * 0.05}>
              <FAQItem {...f} index={i} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
