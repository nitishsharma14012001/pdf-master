import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import * as LucideIcons from 'lucide-react'
import FadeIn from '../ui/FadeIn'
import { getToolById } from '../../utils/tools'

// Curated to exactly the tools this backend implements for real — no
// half-working "coming soon" cards on the homepage.
const PDF_TOOL_IDS = ['merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf', 'protect-pdf', 'unlock-pdf']
const IMAGE_TOOL_IDS = ['jpg-to-pdf', 'png-to-pdf', 'resize-image', 'compress-image', 'crop-image', 'rotate-image']

function ToolCard({ tool, index }) {
  const reduceMotion = useReducedMotion()
  const Icon = LucideIcons[tool.icon] || LucideIcons.FileText

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: index * 0.05 }}
      whileHover={reduceMotion ? {} : { y: -6 }}
    >
      <Link
        to={`/tools/${tool.id}`}
        className="glass-card group relative flex flex-col gap-3 rounded-2xl p-5 h-full transition-shadow duration-300 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
            {tool.label}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {tool.desc}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

function CategoryGrid({ title, toolIds }) {
  const tools = toolIds.map(getToolById).filter(Boolean)
  return (
    <div className="mb-14 last:mb-0">
      <FadeIn className="flex items-center gap-3 mb-6">
        <h3 className="font-display text-xl font-bold" style={{ color: 'var(--text)' }}>
          {title}
        </h3>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </FadeIn>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {tools.map((tool, i) => (
          <ToolCard key={tool.id} tool={tool} index={i} />
        ))}
      </div>
    </div>
  )
}

export default function ToolCategoriesSection() {
  return (
    <section id="tools" className="section">
      <div className="container-main">
        <FadeIn className="text-center mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>
            Tools built to <span className="gradient-text">just work</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            Real, server-side processing for every PDF and image task below — no gimmicks, no half-finished tools.
          </p>
        </FadeIn>

        <CategoryGrid title="PDF Tools" toolIds={PDF_TOOL_IDS} />
        <CategoryGrid title="Image Tools" toolIds={IMAGE_TOOL_IDS} />
      </div>
    </section>
  )
}
