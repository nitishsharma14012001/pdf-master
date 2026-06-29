/**
 * RouteTracker
 *
 * Invisible component that lives inside <BrowserRouter> and fires a GA4
 * page view on every route change — handling the SPA case where the browser
 * never actually navigates to a new page.
 *
 * Also detects 404 renders (NotFoundPage is on the catch-all route "*")
 * and fires a dedicated `page_not_found` event so you can monitor broken
 * links in the GA4 Explore report.
 *
 * Usage: mount once inside App.jsx, just below <ScrollToTop />:
 *   <RouteTracker />
 */

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { sendPageView, track } from '../../analytics'
import { useConsent } from '../../context/ConsentContext'

/** Routes that the app explicitly maps — anything else is a 404 */
const KNOWN_ROUTES = new Set([
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/login',
  '/signup',
  '/forgot-password',
  '/dashboard',
  '/admin',
])

function is404(pathname) {
  if (KNOWN_ROUTES.has(pathname)) return false
  // Tool pages: /tools/<any-slug>
  if (/^\/tools\/[^/]+$/.test(pathname)) return false
  return true
}

export default function RouteTracker() {
  const location              = useLocation()
  const { consentState }      = useConsent()
  const prevPathRef           = useRef(null)

  useEffect(() => {
    // Only track when consent has been granted
    if (consentState !== 'accepted') return
    // Skip if the path hasn't actually changed (e.g. hash-only changes)
    if (location.pathname === prevPathRef.current) return

    prevPathRef.current = location.pathname

    // Small tick so document.title has time to update via react-helmet-async
    const t = setTimeout(() => {
      sendPageView(location.pathname + location.search)

      if (is404(location.pathname)) {
        track.notFound({ path: location.pathname })
      }
    }, 50)

    return () => clearTimeout(t)
  }, [location.pathname, location.search, consentState])

  return null
}
