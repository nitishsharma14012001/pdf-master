/**
 * CookieBanner
 *
 * Slides up from the bottom of the screen for first-time visitors.
 * Disappears immediately on Accept or Decline.
 * Respects prefers-reduced-motion.
 *
 * Styled using only the design tokens already defined in index.css
 * (--bg, --text, --border, btn-primary, btn-secondary) so it matches
 * both light and dark themes with zero extra CSS.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, X } from 'lucide-react'
import { useConsent } from '../../context/ConsentContext'

export default function CookieBanner() {
  const { consentState, accept, decline } = useConsent()
  const [visible, setVisible]             = useState(false)
  const [leaving, setLeaving]             = useState(false)

  // Delay the appearance slightly so it doesn't compete with the page load
  useEffect(() => {
    if (consentState !== 'unknown') return
    const t = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(t)
  }, [consentState])

  if (!visible) return null

  const dismiss = (action) => {
    setLeaving(true)
    // Wait for the slide-out animation before unmounting
    setTimeout(() => {
      setVisible(false)
      action()
    }, 280)
  }

  return (
    <>
      {/* Overlay — subtle backdrop for small screens */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.08)' }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="false"
        aria-label="Cookie consent"
        className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
        style={{
          animation: leaving
            ? 'slideDown 0.28s ease-in forwards'
            : 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        <div
          className="max-w-3xl mx-auto rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{
            background:   'var(--card)',
            border:       '1px solid var(--border)',
            boxShadow:    '0 -4px 40px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.08)',
          }}
        >
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}
            aria-hidden="true"
          >
            <Cookie className="w-5 h-5 text-white" />
          </div>

          {/* Copy */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--text)' }}>
              We use cookies to improve your experience
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Analytics cookies help us understand how people use PDF Master so we can make it better.
              We never sell your data.{' '}
              <Link
                to="/privacy"
                className="underline underline-offset-2 hover:text-blue-600 focus-visible:text-blue-600 transition-colors"
                onClick={() => dismiss(() => {})}
              >
                Privacy Policy
              </Link>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={() => dismiss(decline)}
              className="btn-secondary flex-1 sm:flex-none py-2 px-4 text-sm"
              aria-label="Decline analytics cookies"
            >
              Decline
            </button>
            <button
              onClick={() => dismiss(accept)}
              className="btn-primary flex-1 sm:flex-none py-2 px-4 text-sm"
              aria-label="Accept analytics cookies"
            >
              Accept
            </button>
          </div>

          {/* Close — same as Decline */}
          <button
            onClick={() => dismiss(decline)}
            className="absolute top-3 right-3 sm:static p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close cookie banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Keyframes injected inline to avoid a separate CSS file */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(120%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(120%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"] { animation: none !important; }
        }
      `}</style>
    </>
  )
}
