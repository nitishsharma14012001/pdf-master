const jwt = require('jsonwebtoken')

/**
 * Verify JWT from Authorization header.
 * Attaches `req.user` on success.
 * Returns 401 if missing/invalid, 403 if expired.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Session expired — please log in again' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}

/**
 * Require admin role (use after `authenticate`).
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

/**
 * Soft auth — attaches user if token present but never blocks the request.
 * Useful for endpoints that work both logged-in and anonymous.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    } catch (_) {
      // ignore invalid tokens for optional auth
    }
  }
  next()
}

module.exports = { authenticate, requireAdmin, optionalAuth }
