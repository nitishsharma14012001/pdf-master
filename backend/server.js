'use strict'

/**
 * PDF Master — Express API Server (Security-hardened)
 *
 * Start dev:  npm run dev
 * Start prod: npm start
 *
 * Security layers applied (in middleware order):
 *   1. Helmet            — strict security headers
 *   2. CORS              — explicit origin allowlist from env
 *   3. Morgan            — HTTP request logging (production: combined, dev: dev)
 *   4. express-rate-limit — global + per-route limits
 *   5. body-parser       — hard 1 MB JSON cap (never parse file bodies here)
 *   6. Upload middleware  — MIME + extension + magic-byte validation, 100 MB cap
 *   7. Route handlers    — auth, tools, admin, contact
 *   8. Global error handler — no stack traces in production
 */

require('dotenv').config()

const express     = require('express')
const cors        = require('cors')
const helmet      = require('helmet')
const morgan      = require('morgan')
const compression = require('compression')
const rateLimit   = require('express-rate-limit')
const path        = require('path')
const fs          = require('fs')

const logger                     = require('./utils/logger')
const { startCleanupScheduler }  = require('./utils/cleanup')
const { handleUploadError }      = require('./middleware/upload')

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes    = require('./routes/auth')
const toolsRoutes   = require('./routes/tools')
const adminRoutes   = require('./routes/admin')
const contactRoutes = require('./routes/contact')

const app  = express()
const PORT = parseInt(process.env.PORT || '5000', 10)

// ── Ensure upload directory exists ────────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// Render runs Express behind a proxy. This lets rate limiting and req.ip use the forwarded client IP.
app.set('trust proxy', 1)

// ── 1. Helmet — security headers ──────────────────────────────────────────────
app.use(helmet({
  // Content-Security-Policy: only allow same origin; no inline scripts/styles
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'"],
      imgSrc:         ["'self'", 'data:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      mediaSrc:       ["'self'"],
      frameSrc:       ["'none'"],
      frameAncestors: ["'none'"],   // equivalent of X-Frame-Options: DENY
    },
  },
  // Allow cross-origin file serving (e.g. CDN delivery of processed PDFs)
  crossOriginResourcePolicy:  { policy: 'cross-origin' },
  crossOriginOpenerPolicy:    { policy: 'same-origin' },
  crossOriginEmbedderPolicy:  false,   // keep false so browser can load PDFs inline
  // HSTS — 1 year, include subdomains, preload-ready
  hsts: {
    maxAge:            31_536_000,
    includeSubDomains: true,
    preload:           true,
  },
  // Prevent MIME sniffing
  noSniff: true,
  // Disable the old X-XSS-Protection header (CSP is the modern replacement)
  xssFilter: false,
  // Referrer-Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Permissions-Policy (formerly Feature-Policy)
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}))

// Add Permissions-Policy header explicitly (Helmet 7 does not include it)
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )
  next()
})

// ── 2. CORS — strict origin allowlist ──────────────────────────────────────────
function normalizeOrigin(origin) {
  return origin ? origin.trim().replace(/\/+$/, '') : ''
}

function collectAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)

  const deploymentOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ]
    .map(normalizeOrigin)
    .filter(Boolean)

  return [...new Set([...configured, ...deploymentOrigins])]
}

const allowedOrigins = collectAllowedOrigins()

const corsOptions = {
  origin(origin, cb) {
    // Allow same-origin rewrites, server-to-server calls, curl, and health checks.
    if (!origin) return cb(null, true)

    const normalized = normalizeOrigin(origin)
    if (allowedOrigins.includes(normalized)) return cb(null, true)

    logger.warn('CORS: rejected origin', { origin })
    return cb(null, false)
  },
  credentials:     true,
  methods:         ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders:  ['Content-Type', 'Authorization'],
  exposedHeaders:  ['Content-Disposition'],
  maxAge:          86_400,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))   // handle preflight for all routes

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression())

// ── 3. Morgan — HTTP request logging ─────────────────────────────────────────
// 'combined' in production gives Apache-style logs with remote IP, user-agent, etc.
// 'dev'      in development gives compact coloured output.
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
app.use(morgan(morganFormat, {
  stream: { write: msg => logger.http(msg.trimEnd()) },
  // Skip health-check noise in production
  skip: (req) => process.env.NODE_ENV === 'production' && req.path === '/health',
}))

// ── 4a. Global rate limiter ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs:       parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max:            parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
  standardHeaders: true,   // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders:  false,   // Disable the `X-RateLimit-*` headers
  message:        { error: 'Too many requests — please slow down.' },
  handler(req, res, next, options) {
    logger.warn('Global rate limit hit', { ip: req.ip, path: req.path })
    res.status(options.statusCode).json(options.message)
  },
})
app.use(globalLimiter)

// ── 4b. Auth route rate limiter — prevent brute-force ────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max:      20,
  message:  { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  handler(req, res, next, options) {
    logger.warn('Auth rate limit hit', { ip: req.ip, path: req.path })
    res.status(options.statusCode).json(options.message)
  },
})
app.use('/api/auth/login',    authLimiter)
app.use('/api/auth/register', authLimiter)

// ── 4c. Tool processing rate limiter ─────────────────────────────────────────
const toolLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 min
  max:      15,
  message:  { error: 'Processing rate limit exceeded. Please wait a moment.' },
  handler(req, res, next, options) {
    logger.warn('Tool rate limit hit', { ip: req.ip, path: req.path })
    res.status(options.statusCode).json(options.message)
  },
})
app.use('/api/tools', toolLimiter)

// ── 5. Body parsers ───────────────────────────────────────────────────────────
// Hard cap at 1 MB for JSON payloads — file uploads go through multer only
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  })
})

// ── 6-7. API routes ───────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/tools',   toolsRoutes)
app.use('/api/admin',   adminRoutes)
app.use('/api/contact', contactRoutes)

// ── Multer / upload error handler ─────────────────────────────────────────────
app.use(handleUploadError)

// ── 8. Global error handler ───────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Operational (expected) errors — safe message, no stack trace needed
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      error:   err.message,
      details: err.details,
    })
  }

  // Unexpected errors — log full details, never expose internals
  logger.error('Unhandled error', {
    message: err.message,
    stack:   err.stack,
    path:    req.path,
    method:  req.method,
    ip:      req.ip,
  })

  const isProd = process.env.NODE_ENV === 'production'
  res.status(err.status || 500).json({
    error: isProd ? 'Internal server error' : err.message,
  })
})

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` })
})

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info('PDF Master API started', {
    url:        `http://localhost:${PORT}`,
    env:        process.env.NODE_ENV || 'development',
    uploadDir:  path.resolve(UPLOAD_DIR),
    origins:    allowedOrigins,
  })
  startCleanupScheduler()
})

module.exports = app   // for testing
