import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://pdfmaster.app'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

/**
 * Drop-in SEO component. Renders all standard meta tags for a page —
 * title, description, keywords, canonical, Open Graph, Twitter Card, and
 * (optionally) a JSON-LD structured data block specific to that page.
 *
 * `canonical` should be an absolute URL. Pass just the path (e.g. "/pricing")
 * and it will be resolved against SITE_URL automatically.
 *
 * Usage:
 *   <SEO title="Merge PDF" description="Combine PDFs online." canonical="/tools/merge-pdf" />
 */
export default function SEO({
  title = 'PDF Master — Free Online PDF & Image Tools',
  description = 'Merge, split, compress, convert PDFs and images online for free. Fast, secure, no signup required.',
  keywords,
  canonical,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  jsonLd,
}) {
  const fullTitle = title.includes('PDF Master') ? title : `${title} — PDF Master`
  const canonicalUrl = canonical ? (canonical.startsWith('http') ? canonical : `${SITE_URL}${canonical}`) : undefined

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="PDF Master" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Optional page-specific structured data (e.g. a SoftwareApplication
          entry scoped to one tool, or BreadcrumbList for a deep page). The
          site-wide SoftwareApplication schema already lives in index.html —
          this is for pages that warrant something more specific. */}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  )
}

export { SITE_URL, DEFAULT_IMAGE }
