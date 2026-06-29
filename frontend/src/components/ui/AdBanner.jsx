// Google AdSense placeholder — replace ins tags with real AdSense code in production
export default function AdBanner({ slot = 'horizontal', className = '' }) {
  const sizes = {
    horizontal: { w: '100%', h: '90px', label: 'Advertisement — 728×90' },
    square: { w: '300px', h: '250px', label: 'Advertisement — 300×250' },
    vertical: { w: '160px', h: '600px', label: 'Advertisement — 160×600' },
  }
  const s = sizes[slot] || sizes.horizontal

  if (import.meta.env.PROD) {
    // In production, use real AdSense
    return (
      <div className={`text-center ${className}`}>
        {/* Replace with your AdSense code:
        <ins className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
          data-ad-slot="XXXXXXXXXX"
          data-ad-format="auto"
          data-full-width-responsive="true" /> */}
        <div className="ad-placeholder" style={{ width: s.w, height: s.h }}>{s.label}</div>
      </div>
    )
  }

  return (
    <div className={`flex justify-center ${className}`}>
      <div className="ad-placeholder" style={{ width: s.w, height: s.h, maxWidth: '100%' }}>
        {s.label}
      </div>
    </div>
  )
}
