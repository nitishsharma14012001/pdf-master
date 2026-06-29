import { Zap, ShieldCheck, UserCheck, Smartphone } from 'lucide-react'
import FadeIn from '../ui/FadeIn'

const FEATURES = [
  {
    icon: Zap,
    title: 'Fast Processing',
    desc: 'Server-side processing handles even large files in seconds, so you spend less time waiting and more time done.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Files',
    desc: 'Every upload is transferred over TLS and automatically deleted after processing — your files are never kept around.',
  },
  {
    icon: UserCheck,
    title: 'No Registration',
    desc: 'Every tool works the moment you land on the page. No account, no email, no credit card.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Friendly',
    desc: "Built to work just as well on a phone in your pocket as it does on a desktop browser.",
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="section" style={{ background: 'var(--bg-secondary)' }}>
      <div className="container-main">
        <FadeIn className="text-center mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>
            Why people choose <span className="gradient-text">PDF Master</span>
          </h2>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.08} className="glass-card rounded-2xl p-6 h-full">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <f.icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text)' }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {f.desc}
              </p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
