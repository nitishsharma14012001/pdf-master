import { Star } from 'lucide-react'
import FadeIn from '../ui/FadeIn'

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    role: 'Marketing Manager',
    avatar: 'SC',
    text: 'PDF Master saves me hours every week. The merge and compress tools are fast and the output quality is always perfect — I stopped looking for alternatives.',
    rating: 5,
  },
  {
    name: 'David Okonkwo',
    role: 'Freelance Designer',
    avatar: 'DO',
    text: "I send proofs to clients constantly. Converting and resizing images before turning them into a single PDF used to take three apps — now it's one tab.",
    rating: 5,
  },
  {
    name: 'Priya Nair',
    role: 'Legal Assistant',
    avatar: 'PN',
    text: 'The protect and unlock tools are essential for case files. It handles large, multi-hundred-page documents without ever choking or corrupting anything.',
    rating: 5,
  },
]

export default function TestimonialsSection() {
  return (
    <section className="section overflow-hidden">
      <div className="container-main">
        <FadeIn className="text-center mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>
            Trusted by people who <span className="gradient-text">get things done</span>
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.1} className="glass-card rounded-2xl p-6 h-full flex flex-col">
              <div className="flex items-center gap-1 mb-4" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: t.rating }).map((_, idx) => (
                  <Star key={idx} className="w-4 h-4 text-yellow-400 fill-yellow-400" aria-hidden="true" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-5 italic flex-1" style={{ color: 'var(--text-muted)' }}>
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {t.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t.role}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
