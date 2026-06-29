/**
 * ConsentContext
 *
 * Manages cookie/analytics consent across the app.
 *
 * State machine:
 *   'unknown'  → shown the banner
 *   'accepted' → banner hidden, analytics initialised
 *   'declined' → banner hidden, analytics never initialised
 *
 * Consent is persisted in localStorage under the key 'pm_cookie_consent'
 * so the banner only appears once per browser.
 *
 * The context also exposes `consentState` and `revisitConsent()` so a
 * Privacy page can let users change their mind.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { initAnalytics, track } from '../analytics'

const STORAGE_KEY = 'pm_cookie_consent'
const VALID_STATES = ['accepted', 'declined']

const ConsentContext = createContext(null)

export function ConsentProvider({ children }) {
  const [consentState, setConsentState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return VALID_STATES.includes(stored) ? stored : 'unknown'
    } catch {
      return 'unknown'
    }
  })

  // Boot analytics once on mount if the user already accepted in a previous session
  useEffect(() => {
    if (consentState === 'accepted') {
      initAnalytics(window.location.pathname)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (state) => {
    try { localStorage.setItem(STORAGE_KEY, state) } catch { /* storage unavailable */ }
  }

  const accept = useCallback(() => {
    persist('accepted')
    setConsentState('accepted')
    initAnalytics(window.location.pathname)
    track.consentAccepted()
  }, [])

  const decline = useCallback(() => {
    persist('declined')
    setConsentState('declined')
    // track.consentDeclined() is intentionally a no-op when GA4 is uninitialised
  }, [])

  /** Let users reopen the banner from the Privacy page */
  const revisitConsent = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setConsentState('unknown')
  }, [])

  return (
    <ConsentContext.Provider value={{ consentState, accept, decline, revisitConsent }}>
      {children}
    </ConsentContext.Provider>
  )
}

/** @returns {{ consentState: 'unknown'|'accepted'|'declined', accept: Function, decline: Function, revisitConsent: Function }} */
export function useConsent() {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent must be used inside <ConsentProvider>')
  return ctx
}
