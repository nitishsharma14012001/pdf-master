/**
 * components/ui/LazyImage.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * A thin wrapper around <img> that defaults to native lazy-loading and
 * async decoding, and requires explicit width/height so the browser can
 * reserve layout space before the image loads (preventing layout shift,
 * which both Core Web Vitals (CLS) and real users care about).
 *
 * The current app renders all icons via lucide-react SVG components, so
 * there are no raw <img> tags to retrofit today — this component exists
 * so any future real image (testimonial photos, blog thumbnails, a
 * marketing screenshot) is lazy-loaded correctly from the start instead
 * of as an afterthought.
 *
 * Usage:
 *   <LazyImage src="/testimonials/sarah.jpg" alt="Sarah Chen" width={64} height={64} className="rounded-full" />
 */
export default function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  ...rest
}) {
  if (!alt) {
    // Decorative images should pass alt="" explicitly and intentionally —
    // a missing alt prop almost always means a real accessibility bug.
    console.warn(`LazyImage: missing "alt" text for image "${src}"`)
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={className}
      {...rest}
    />
  )
}
