const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const logger = require('../utils/logger')

// ── In-memory user store (replace with DB in production) ──────────────────────
const users = new Map()

// Seed two demo accounts
;(async () => {
  users.set('admin@pdfmaster.app', {
    id: '1',
    name: 'Admin User',
    email: 'admin@pdfmaster.app',
    passwordHash: await bcrypt.hash('admin123', 10),
    role: 'admin',
    plan: 'pro',
    createdAt: new Date().toISOString(),
    filesProcessed: 0,
  })
  users.set('user@example.com', {
    id: '2',
    name: 'John Doe',
    email: 'user@example.com',
    passwordHash: await bcrypt.hash('user123', 10),
    role: 'user',
    plan: 'free',
    createdAt: new Date().toISOString(),
    filesProcessed: 0,
  })
})()

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, plan: user.plan, name: user.name },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

function safeUser(u) {
  const { passwordHash, ...rest } = u
  return rest
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register',
  body('name').trim().isLength({ min: 2, max: 80 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(422).json({ error: errors.array()[0].msg })

    const { name, email, password } = req.body

    if (users.has(email)) {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = {
      id: String(Date.now()),
      name,
      email,
      passwordHash,
      role: 'user',
      plan: 'free',
      createdAt: new Date().toISOString(),
      filesProcessed: 0,
    }
    users.set(email, user)

    logger.info('New user registered', { email, name })
    const token = signToken(user)
    res.status(201).json({ token, user: safeUser(user) })
  }
)

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(422).json({ error: 'Invalid email or password format' })

    const { email, password } = req.body
    const user = users.get(email)

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    logger.info('User logged in', { email })
    const token = signToken(user)
    res.json({ token, user: safeUser(user) })
  }
)

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    const { email } = req.body
    // In production: generate a reset token, store it, send email
    // We always respond 200 to avoid user enumeration
    logger.info('Password reset requested', { email })
    res.json({ message: 'If an account exists, a reset link has been sent.' })
  }
)

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const user = users.get(req.user.email)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user: safeUser(user) })
})

// ── PUT /api/auth/me ──────────────────────────────────────────────────────────
router.put('/me',
  authenticate,
  body('name').optional().trim().isLength({ min: 2, max: 80 }),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(422).json({ error: errors.array()[0].msg })

    const user = users.get(req.user.email)
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (req.body.name) user.name = req.body.name
    users.set(user.email, user)

    res.json({ user: safeUser(user) })
  }
)

module.exports = router
