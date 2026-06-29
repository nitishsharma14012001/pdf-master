import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { CheckCircle2, Crown, Zap, Shield } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'All the essentials, no strings attached.',
    badge: null,
    cta: 'Start for Free',
    ctaLink: '/signup',
    highlight: false,
    features: [
      '25 MB max file size',
      'All core PDF tools',
      'All image tools',
      '5 files per day',
      'Standard processing speed',
      'Files deleted after 1 hour',
      'No watermarks',
      'Browser-based processing',
    ],
    missing: ['Batch processing', 'API access', 'Priority support', 'Custom watermarks'],
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/ month',
    desc: 'Power features for professionals.',
    badge: 'Most Popular',
    cta: 'Start Pro Trial',
    ctaLink: '/signup',
    highlight: true,
    features: [
      '200 MB max file size',
      'All Free features',
      'Batch processing (20 files)',
      'Priority processing queue',
      'API access (500 req/mo)',
      'Download history (30 days)',
      'Custom watermarks',
      'Email support',
    ],
    missing: ['Unlimited API access', 'Dedicated support'],
  },
  {
    name: 'Business',
    price: '$29',
    period: '/ month',
    desc: 'For teams and heavy workflows.',
    badge: null,
    cta: 'Contact Sales',
    ctaLink: '/contact',
    highlight: false,
    features: [
      '1 GB max file size',
      'All Pro features',
      'Unlimited batch processing',
      'Unlimited API access',
      'Dedicated processing server',
      'Download history (1 year)',
      'White-label output',
      '5 team seats',
      'Priority phone support',
      'SLA guarantee',
    ],
    missing: [],
  },
]

export default function PricingPage() {
  return (
    <>
      <Helmet>
        <title>Pricing — PDF Master</title>
        <meta name="description" content="PDF Master pricing plans — free forever, or upgrade to Pro for batch processing, larger files, and API access." />
      </Helmet>

      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="font-display text-5xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>
              Simple, honest <span className="gradient-text">pricing</span>
            </h1>
            <p className="text-xl max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
              Start free. Upgrade only when you need more power. No hidden fees, no surprises.
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {plans.map(plan => (
              <div key={plan.name} className={`rounded-3xl p-8 relative ${plan.highlight ? 'ring-2 ring-blue-500' : ''}`} style={{ background: 'var(--card)', border: plan.highlight ? undefined : '1px solid var(--border)' }}>
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{plan.name}</p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="font-display text-5xl font-extrabold" style={{ color: 'var(--text)' }}>{plan.price}</span>
                    <span className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{plan.period}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{plan.desc}</p>
                </div>

                <Link
                  to={plan.ctaLink}
                  className={`block text-center py-3 rounded-xl font-semibold mb-8 transition-all ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {plan.cta}
                </Link>

                <div className="space-y-3">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{f}</span>
                    </div>
                  ))}
                  {plan.missing.map(f => (
                    <div key={f} className="flex items-start gap-3 opacity-40">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-sm line-through" style={{ color: 'var(--text-muted)' }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Trust section */}
          <div className="rounded-3xl p-10 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <h2 className="font-display text-2xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>All plans include</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
              {[
                { icon: Shield, label: 'SSL Encryption', desc: 'All transfers encrypted' },
                { icon: Zap, label: 'Fast Processing', desc: 'Cloud-powered speed' },
                { icon: Crown, label: 'No Watermarks', desc: 'Clean output files' },
                { icon: CheckCircle2, label: '99.9% Uptime', desc: 'Reliable service SLA' },
              ].map(f => (
                <div key={f.label} className="text-center">
                  <f.icon className="w-7 h-7 text-blue-600 mx-auto mb-2" />
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{f.label}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
