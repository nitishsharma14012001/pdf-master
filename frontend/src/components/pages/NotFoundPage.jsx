/**
 * NotFoundPage with analytics
 *
 * Fires track.notFound() on mount as a belt-and-suspenders complement to
 * RouteTracker's catch-all detection — this fires even if RouteTracker's
 * known-route list is ever out of date.
 *
 * Drop this file in to replace the existing NotFoundPage export inside
 * src/components/pages/StaticPages.jsx, or import it as a standalone
 * component and add it to the catch-all route in App.jsx.
 *
 * All other static pages (ContactPage, AboutPage, PrivacyPage, TermsPage)
 * are unchanged — this file only patches NotFoundPage.
 */

import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { track } from '../../analytics'

export function NotFoundPage() {
  const location = useLocation()

  useEffect(() => {
    track.notFound({ path: location.pathname })
  }, [location.pathname])

  return (
    <>
      <Helmet>
        <title>Page Not Found — PDF Master</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="font-display text-9xl font-extrabold gradient-text mb-4">404</p>
          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text)' }}>Page not found</h1>
          <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
            The page you're looking for doesn't exist or was moved.
          </p>
          <Link to="/" className="btn-primary">
            Back to home
          </Link>
        </div>
      </div>
    </>
  )
}
