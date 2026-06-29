import { useState, useRef, useCallback } from 'react'

/**
 * Drop-in replacement for a <button> or <Link>-like element that adds a
 * tactile ripple emanating from the click point. Purely a visual layer —
 * pass `as={Link}` plus its props (e.g. `to="/foo"`) to ripple a router
 * link, or leave as the default <button>.
 */
export default function RippleButton({ as: As = 'button', className = '', onClick, children, ...rest }) {
  const [ripples, setRipples] = useState([])
  const hostRef = useRef(null)
  const idRef = useRef(0)

  const spawnRipple = useCallback((event) => {
    const host = hostRef.current
    if (!host) return

    const rect = host.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const x = (event.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2
    const y = (event.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2

    const id = idRef.current++
    setRipples((prev) => [...prev, { id, x, y, size }])

    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, 650)
  }, [])

  const handleClick = (event) => {
    spawnRipple(event)
    onClick?.(event)
  }

  return (
    <As
      ref={hostRef}
      onClick={handleClick}
      className={`relative overflow-hidden isolate ${className}`}
      {...rest}
    >
      <span className="relative z-10">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
            background: 'radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)',
            animation: 'ripple-expand 650ms ease-out forwards',
          }}
        />
      ))}
    </As>
  )
}
