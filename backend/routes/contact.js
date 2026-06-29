const router = require('express').Router()
const { body, validationResult } = require('express-validator')
const logger = require('../utils/logger')

// ── POST /api/contact ──────────────────────────────────────────────────────
router.post('/',
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('message').trim().isLength({ min: 10, max: 5000 }),
  (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array()[0].msg })
    }

    const { name, email, subject, message } = req.body

    // In production: send email via Resend / SendGrid / SMTP
    logger.info('Contact form submission', { name, email, subject })

    res.json({
      success: true,
      message: 'Your message has been received. We\'ll reply within 24 hours.',
    })
  }
)

module.exports = router
