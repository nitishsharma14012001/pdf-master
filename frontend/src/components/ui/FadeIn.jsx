import { motion, useReducedMotion } from 'framer-motion'

/**
 * Wraps children in a fade-up reveal that plays once when scrolled into
 * view. Respects prefers-reduced-motion by skipping the animation
 * entirely (content is simply visible, no motion).
 */
export default function FadeIn({ children, delay = 0, y = 24, className = '', as = 'div', ...rest }) {
  const reduceMotion = useReducedMotion()
  const Component = motion[as] || motion.div

  if (reduceMotion) {
    const Plain = as
    return <Plain className={className}>{children}</Plain>
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      {...rest}
    >
      {children}
    </Component>
  )
}
