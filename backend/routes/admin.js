/**
 * PDF Master — backend/routes/admin.js  (REPLACE existing file)
 *
 * All admin endpoints are protected by JWT + requireAdmin middleware.
 * GET  /api/admin/dashboard
 * GET  /api/admin/analytics  ?period=7d|30d|24h
 * GET  /api/admin/logs       ?level=error&search=xxx&limit=150
 * GET  /api/admin/server
 * GET  /api/admin/settings
 * PUT  /api/admin/settings
 * POST /api/admin/maintenance/cleanup
 * GET  /api/admin/stats          (legacy — kept for backwards compat)
 * GET  /api/admin/analytics-legacy
 */

'use strict'

const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const { authenticate, requireAdmin } = require('../middleware/auth')
const {
  getDashboard,
  getAnalytics,
  getLogs,
  getServer,
  getSettings,
  updateSettings,
  triggerCleanup,
} = require('../controllers/adminController')

// ── Apply auth to every admin route ──────────────────────────────────────────
router.use(authenticate, requireAdmin)

// ── Extra rate-limiting for admin endpoints ───────────────────────────────────
// Prevents brute-force enumeration even for authenticated admins.
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 60,               // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Admin API rate limit exceeded' },
})
router.use(adminLimiter)

// ── Routes ────────────────────────────────────────────────────────────────────

// Dashboard KPIs
router.get('/dashboard', getDashboard)

// Analytics + tool usage
router.get('/analytics', getAnalytics)

// Log viewer
router.get('/logs', getLogs)

// Server / OS metrics
router.get('/server', getServer)

// Settings CRUD
router.get('/settings',  getSettings)
router.put('/settings',  updateSettings)

// Maintenance actions
router.post('/maintenance/cleanup', triggerCleanup)

// ── Legacy compatibility ──────────────────────────────────────────────────────
// The old AdminPage.jsx called /stats and /analytics with different shapes.
// We keep these so old code doesn't 404 while you migrate.

router.get('/stats', (req, res) => {
  // Proxy to dashboard controller
  getDashboard(req, res)
})

module.exports = router
