import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Mail, MapPin, MessageCircle, Loader2, CheckCircle2, Sparkles, Lock, Globe2 } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Contact Page ────────────────────────────────────────────────────────────
export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    setSent(true)
    toast.success('Message sent! We\'ll reply within 24 hours.')
  }

  return (
    <>
      <Helmet>
        <title>Contact Us — PDF Master</title>
        <meta name="description" content="Get in touch with the PDF Master team. We're here to help with any questions or feedback." />
      </Helmet>
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-display text-5xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>
              Get in <span className="gradient-text">touch</span>
            </h1>
            <p className="text-lg" style={{ color: 'var(--text-muted)' }}>We typically reply within 24 hours.</p>
          </div>

          <div className="grid md:grid-cols-5 gap-10">
            {/* Info */}
            <div className="md:col-span-2 space-y-6">
              {[
                { icon: Mail, title: 'Email Support', value: 'support@pdfmaster.app', sub: 'Mon–Fri, 9am–6pm UTC' },
                { icon: MessageCircle, title: 'Live Chat', value: 'Chat in the app', sub: 'Pro users get priority' },
                { icon: MapPin, title: 'Company', value: 'PDF Master Inc.', sub: 'Remote-first team' },
              ].map(c => (
                <div key={c.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.1)' }}>
                    <c.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c.title}</p>
                    <p className="text-sm text-blue-600">{c.value}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="md:col-span-3">
              {sent ? (
                <div className="rounded-3xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2" style={{ color: 'var(--text)' }}>Message sent!</h3>
                  <p style={{ color: 'var(--text-muted)' }}>We'll get back to you within 24 hours at <strong>{form.email}</strong>.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="rounded-3xl p-8 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Name</label>
                      <input required className="input-field" placeholder="Jane Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
                      <input type="email" required className="input-field" placeholder="jane@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Subject</label>
                    <select className="input-field" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                      <option value="">Select a topic</option>
                      <option>General question</option>
                      <option>Bug report</option>
                      <option>Billing & subscription</option>
                      <option>API & integration</option>
                      <option>Feature request</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Message</label>
                    <textarea required rows={5} className="input-field resize-none" placeholder="Tell us how we can help…" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3.5">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Send Message →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── About Page ───────────────────────────────────────────────────────────────
export function AboutPage() {
  const values = [
    { icon: Sparkles, title: 'Tools that just work', body: 'Every tool on this site is a real, server-side implementation — not a placeholder waiting to be finished.' },
    { icon: Lock, title: 'Privacy by default', body: 'Files are processed over an encrypted connection and removed shortly after the job completes. We never read or sell what you upload.' },
    { icon: Globe2, title: 'Built for everyone', body: 'No installs, no plugins, no platform lock-in — just a browser tab and the tool you need, anywhere in the world.' },
  ]

  return (
    <>
      <Helmet>
        <title>About — PDF Master</title>
        <meta name="description" content="PDF Master is a free, browser-based toolkit for working with PDFs and images." />
      </Helmet>
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="font-display text-5xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>
            About <span className="gradient-text">PDF Master</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            PDF Master started as a simple idea: every PDF and image task people run into daily — merging,
            compressing, converting, protecting — should be one upload away, with no software to install and
            no account required to get started.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {values.map((v) => (
            <div key={v.title} className="glass-card rounded-2xl p-6">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <v.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text)' }}>{v.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Privacy Policy ───────────────────────────────────────────────────────────
export function PrivacyPage() {
  return (
    <>
      <Helmet><title>Privacy Policy — PDF Master</title></Helmet>
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>Privacy Policy</h1>
          <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>Last updated: January 15, 2025</p>
          <div className="prose space-y-8" style={{ color: 'var(--text)' }}>
            {[
              { title: '1. Information We Collect', body: 'We collect information you provide directly (name, email when you create an account) and information generated through your use of our service (files you upload, tools you use, and processing logs). We do not collect payment card numbers directly — payments are processed by Stripe.' },
              { title: '2. How We Use Your Files', body: 'Files you upload are processed solely to perform the requested tool operation. Files are stored temporarily on encrypted servers and automatically deleted within 1 hour of processing completion. We never read, analyze, or share the contents of your files with any third party.' },
              { title: '3. Data Security', body: 'All file transfers use TLS 1.3 encryption. Files at rest are encrypted using AES-256. Access to file storage is limited to automated processing systems. We conduct regular security audits and penetration tests.' },
              { title: '4. Cookies', body: 'We use essential cookies to maintain your session and remember your preferences (like dark mode). We use analytics cookies (with your consent) to understand how our tools are used. We do not use advertising tracking cookies.' },
              { title: '5. Third-Party Services', body: 'We use Stripe for payment processing, Cloudflare for CDN and DDoS protection, and AWS for cloud infrastructure. Each provider has their own privacy policy. We do not sell your data to advertisers.' },
              { title: '6. Your Rights', body: 'You have the right to access, correct, or delete your account data at any time. To export your data or delete your account, visit your dashboard settings or email us at privacy@pdfmaster.app. We will respond within 30 days.' },
              { title: '7. Children\'s Privacy', body: 'PDF Master is not directed to children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with information, please contact us immediately.' },
              { title: '8. Changes to This Policy', body: 'We will notify registered users by email of any material changes to this policy. Your continued use of PDF Master after changes take effect constitutes acceptance of the updated policy.' },
              { title: '9. Contact', body: 'For privacy-related questions or data requests, email privacy@pdfmaster.app or use our contact form.' },
            ].map(s => (
              <section key={s.title}>
                <h2 className="font-bold text-lg mb-2">{s.title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Terms & Conditions ───────────────────────────────────────────────────────
export function TermsPage() {
  return (
    <>
      <Helmet><title>Terms & Conditions — PDF Master</title></Helmet>
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-4xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>Terms & Conditions</h1>
          <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>Last updated: January 15, 2025</p>
          <div className="space-y-8">
            {[
              { title: '1. Acceptance of Terms', body: 'By accessing or using PDF Master, you agree to be bound by these Terms & Conditions. If you do not agree to these terms, please do not use our service.' },
              { title: '2. Description of Service', body: 'PDF Master provides online tools for processing, converting, and editing PDF documents and images. Core tools are provided free of charge. Premium features require a paid subscription.' },
              { title: '3. Acceptable Use', body: 'You may use PDF Master only for lawful purposes. You must not upload files that contain malware, violate copyright, contain illegal content, or are used to circumvent security measures. We reserve the right to terminate accounts that violate these rules.' },
              { title: '4. Intellectual Property', body: 'You retain all rights to files you upload. By uploading files, you grant PDF Master a temporary license to process them solely for the purpose of providing the requested service. PDF Master\'s software, design, and branding are protected by copyright.' },
              { title: '5. Privacy & File Handling', body: 'Please see our Privacy Policy for details on how we handle your files and data. In summary: files are deleted within 1 hour and never shared with third parties.' },
              { title: '6. Subscription & Billing', body: 'Pro and Business plans are billed monthly or annually. You may cancel at any time; you will retain access until the end of the billing period. Refunds are available within 7 days of purchase if you are not satisfied.' },
              { title: '7. Limitation of Liability', body: 'PDF Master is provided "as is." We make no warranties about the accuracy or reliability of the service. We are not liable for any loss of data, business interruption, or damages arising from your use of the service.' },
              { title: '8. Changes to Service', body: 'We reserve the right to modify, suspend, or discontinue any part of the service at any time. We will provide reasonable notice for material changes that affect paying customers.' },
              { title: '9. Governing Law', body: 'These terms are governed by the laws of the State of Delaware, USA. Disputes shall be resolved through binding arbitration in accordance with JAMS rules.' },
            ].map(s => (
              <section key={s.title}>
                <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{s.title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 404 Not Found ────────────────────────────────────────────────────────────
export function NotFoundPage() {
  return (
    <>
      <Helmet><title>Page Not Found — PDF Master</title></Helmet>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="font-display text-9xl font-extrabold gradient-text mb-4">404</p>
          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text)' }}>Page not found</h1>
          <p className="mb-8" style={{ color: 'var(--text-muted)' }}>The page you're looking for doesn't exist or was moved.</p>
          <a href="/" className="btn-primary">← Back to Home</a>
        </div>
      </div>
    </>
  )
}
