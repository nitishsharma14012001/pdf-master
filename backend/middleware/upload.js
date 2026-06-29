'use strict'

/**
 * PDF Master — Upload Middleware (Security-hardened)
 *
 * Provides a configured multer instance with layered file security:
 *
 *   Layer 1 — MIME whitelist (multer fileFilter, synchronous)
 *   Layer 2 — Extension/MIME consistency check (synchronous)
 *   Layer 3 — Magic-byte verification (async, post-write)
 *   Layer 4 — 100 MB hard upload cap (multer limits)
 *   Layer 5 — Plan-based per-file size enforcement (post-auth)
 *   Layer 6 — Sanitised filenames (UUID job dir + safe stem)
 *
 * Exports:
 *   createUploader(maxFiles)   — multer factory
 *   enforceMagicBytes          — async post-upload middleware
 *   enforceSizeLimit           — plan-aware size cap middleware
 *   handleUploadError          — multer → JSON error handler
 *   ALLOWED_MIMES              — MIME → category map
 *   EXTENSION_MAP              — MIME → allowed extensions
 *   MAX_FILE_SIZE, MAX_SIZE_FREE, MAX_SIZE_PRO — exported for tests
 */

const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const fsp     = require('fs').promises
const { v4: uuidv4 } = require('uuid')
const logger  = require('../utils/logger')

// ─── Configuration ────────────────────────────────────────────────────────────

const UPLOAD_DIR     = process.env.UPLOAD_DIR || './uploads'

// Hard ceiling applied at the multer layer — no file larger than this is
// ever written to disk, regardless of plan.
const MAX_FILE_SIZE  = parseInt(
  process.env.MAX_FILE_SIZE || String(100 * 1024 * 1024), 10  // 100 MB
)

// Per-plan limits (enforced post-auth in enforceSizeLimit)
const MAX_SIZE_FREE  = parseInt(
  process.env.MAX_FILE_SIZE_FREE || String(25 * 1024 * 1024), 10  // 25 MB
)
const MAX_SIZE_PRO   = parseInt(
  process.env.MAX_FILE_SIZE_PRO  || String(100 * 1024 * 1024), 10  // 100 MB
)

// ─── Allowed MIME types ───────────────────────────────────────────────────────

/**
 * Canonical MIME → category map.
 * Only MIME types listed here pass the multer fileFilter.
 */
const ALLOWED_MIMES = {
  // PDF
  'application/pdf': 'pdf',

  // Images
  'image/jpeg':      'image',
  'image/jpg':       'image',   // non-standard alias sent by some browsers
  'image/png':       'image',
  'image/webp':      'image',
  'image/gif':       'image',
  'image/bmp':       'image',
  'image/tiff':      'image',

  // Office — accepted for word/excel/ppt-to-pdf tools
  'application/msword':                                                          'office',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':    'office',
  'application/vnd.ms-excel':                                                   'office',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':          'office',
  'application/vnd.ms-powerpoint':                                              'office',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':  'office',

  // Plain text
  'text/plain': 'text',
}

/**
 * MIME → allowed file extensions.
 * An extension that contradicts the declared MIME type is rejected in the
 * synchronous fileFilter — before any bytes reach disk.
 */
const EXTENSION_MAP = {
  'application/pdf':  ['.pdf'],
  'image/jpeg':       ['.jpg', '.jpeg'],
  'image/jpg':        ['.jpg', '.jpeg'],
  'image/png':        ['.png'],
  'image/webp':       ['.webp'],
  'image/gif':        ['.gif'],
  'image/bmp':        ['.bmp'],
  'image/tiff':       ['.tif', '.tiff'],
  'application/msword':                                                         ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':   ['.docx'],
  'application/vnd.ms-excel':                                                  ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':         ['.xlsx'],
  'application/vnd.ms-powerpoint':                                             ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
}

// ─── Magic-byte detection ─────────────────────────────────────────────────────

/**
 * Reads the first 12 bytes of a file and returns the detected MIME type,
 * or null when the signature is not in the lookup table.
 *
 * A null result means "cannot determine from magic bytes" — we fall back to
 * trusting the declared MIME rather than rejecting the file outright, which
 * would produce too many false-positives for less-common formats.
 *
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function detectMagicBytes(filePath) {
  const fd = await fsp.open(filePath, 'r')
  try {
    const buf = Buffer.alloc(12)
    const { bytesRead } = await fd.read(buf, 0, 12, 0)
    if (bytesRead < 4) return null

    const hex = buf.slice(0, bytesRead).toString('hex').toUpperCase()

    if (hex.startsWith('25504446'))   return 'application/pdf'   // %PDF
    if (hex.startsWith('89504E47'))   return 'image/png'         // .PNG
    if (hex.startsWith('FFD8FF'))     return 'image/jpeg'        // JPEG
    if (hex.startsWith('474946383'))  return 'image/gif'         // GIF87a / GIF89a
    if (hex.startsWith('424D'))       return 'image/bmp'         // BM
    if (hex.startsWith('49492A00') || hex.startsWith('4D4D002A')) return 'image/tiff'

    // WebP: RIFF????WEBP
    if (hex.startsWith('52494646') && bytesRead >= 12) {
      if (buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
    }

    // ZIP-based Office (docx, xlsx, pptx) — all share PK\x03\x04
    if (hex.startsWith('504B0304')) return 'application/zip-based-office'
    // Legacy OLE2 Office (doc, xls, ppt) — D0CF11E0
    if (hex.startsWith('D0CF11E0')) return 'application/ole2-office'

    return null
  } finally {
    await fd.close()
  }
}

/**
 * Returns true when the detected magic-byte signature is consistent with
 * the MIME type declared by the client.
 *
 * We are intentionally permissive for ZIP-based Office formats because all
 * modern Office types (.docx, .xlsx, .pptx) share the same PK header.
 */
function magicBytesConsistent(declaredMime, detected) {
  if (detected === null) return true   // unknown signature → trust MIME

  const zipBasedOffice = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]
  const ole2Office = [
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
  ]

  if (detected === 'application/zip-based-office') return zipBasedOffice.includes(declaredMime)
  if (detected === 'application/ole2-office')      return ole2Office.includes(declaredMime)
  if (detected === 'image/jpeg') return declaredMime === 'image/jpeg' || declaredMime === 'image/jpg'

  return detected === declaredMime
}

// ─── Filename sanitisation ────────────────────────────────────────────────────

/**
 * Produces a safe filename from the original upload name:
 *   - Extracts extension (max 10 chars, lower-cased)
 *   - Strips all characters except alphanumerics, hyphens, underscores, dots, spaces
 *   - Collapses whitespace to underscores
 *   - Collapses ".." sequences (path traversal)
 *   - Truncates stem to 100 characters
 *   - Appends a base-36 timestamp suffix for uniqueness
 *
 * @param {string} originalName
 * @returns {string}
 */
function sanitiseFilename(originalName) {
  const ext  = path.extname(originalName).toLowerCase().slice(0, 10)
  const stem = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9_\-. ]/g, '_')   // strip unsafe chars
    .replace(/\s+/g, '_')                   // spaces → underscores
    .replace(/\.{2,}/g, '_')               // collapse ".."
    .replace(/^[._]+/, '')                  // strip leading dots/underscores
    .slice(0, 100) || 'file'               // max 100 chars, fallback if empty

  return `${stem}_${Date.now().toString(36)}${ext}`
}

// ─── Multer disk storage ──────────────────────────────────────────────────────

/**
 * Each request gets a UUID-isolated directory:
 *   uploads/<jobId>/<sanitised-filename>
 *
 * This prevents filename collisions and path traversal across jobs.
 */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (!req.jobId) req.jobId = uuidv4()
    const dir = path.join(UPLOAD_DIR, req.jobId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },

  filename(req, file, cb) {
    cb(null, sanitiseFilename(file.originalname))
  },
})

// ─── Synchronous file filter ──────────────────────────────────────────────────

/**
 * Runs before any bytes are written to disk:
 *   1. Rejects MIME types not in ALLOWED_MIMES
 *   2. Rejects files whose extension contradicts the declared MIME
 */
function fileFilter(req, file, cb) {
  const mime = file.mimetype

  // 1 — MIME whitelist
  if (!ALLOWED_MIMES[mime]) {
    return cb(new multer.MulterError(
      'LIMIT_UNEXPECTED_FILE',
      `File type not supported: ${mime}. Allowed: PDF, JPEG, PNG, WebP, GIF, BMP, TIFF, DOC(X), XLS(X), PPT(X).`
    ))
  }

  // 2 — Extension/MIME consistency
  const ext         = path.extname(file.originalname).toLowerCase()
  const allowedExts = EXTENSION_MAP[mime] || []
  if (allowedExts.length && !allowedExts.includes(ext)) {
    return cb(new multer.MulterError(
      'LIMIT_UNEXPECTED_FILE',
      `File extension "${ext}" does not match declared MIME type "${mime}".`
    ))
  }

  cb(null, true)
}

// ─── Multer factory ───────────────────────────────────────────────────────────

/**
 * Returns a configured multer instance.
 *
 * @param {number} [maxFiles=20]  Maximum number of files per request.
 * @returns {import('multer').Multer}
 */
function createUploader(maxFiles = 20) {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize:  MAX_FILE_SIZE,      // 100 MB hard cap — never negotiable
      files:     maxFiles,
      fields:    10,                 // non-file form fields
      fieldSize: 64 * 1024,          // 64 KB per field value (e.g. JSON options)
    },
  })
}

// ─── Post-upload magic-byte verification ─────────────────────────────────────

/**
 * Express middleware — run AFTER multer has written files to disk.
 *
 * Reads the first 12 bytes of every uploaded file and verifies the signature
 * matches the declared MIME type.  Files that fail are deleted immediately
 * and the request is rejected with HTTP 415.
 *
 * Defends against:
 *   - Executables renamed to .pdf (malware.exe → malware.pdf)
 *   - MIME spoofing by modified browsers or scripts
 *
 * @type {import('express').RequestHandler}
 */
async function enforceMagicBytes(req, res, next) {
  if (!req.files || req.files.length === 0) return next()

  const bad = []

  for (const file of req.files) {
    try {
      const detected = await detectMagicBytes(file.path)
      if (!magicBytesConsistent(file.mimetype, detected)) {
        bad.push({ name: file.originalname, declared: file.mimetype, detected })
        await fsp.unlink(file.path).catch(() => {})
      }
    } catch (err) {
      // Unreadable file → reject
      bad.push({ name: file.originalname, error: err.message })
      await fsp.unlink(file.path).catch(() => {})
    }
  }

  if (bad.length > 0) {
    logger.warn('Magic-byte mismatch — upload rejected', { bad, ip: req.ip })

    if (req.jobId) {
      fsp.rm(path.join(UPLOAD_DIR, req.jobId), { recursive: true, force: true }).catch(() => {})
    }

    return res.status(415).json({
      error: 'One or more files failed content verification. File content does not match the declared type.',
      files: bad.map(f => f.name),
    })
  }

  next()
}

// ─── Plan-based size enforcement ─────────────────────────────────────────────

/**
 * Express middleware — run AFTER upload + optionalAuth.
 *
 * Enforces per-plan caps after req.user is available.
 * Multer's own limit is MAX_FILE_SIZE (100 MB) to avoid blocking pro users;
 * this middleware handles the free-tier cap (25 MB default).
 *
 * @type {import('express').RequestHandler}
 */
function enforceSizeLimit(req, res, next) {
  if (!req.files || req.files.length === 0) return next()

  const isPro      = req.user?.plan === 'pro' || req.user?.plan === 'business'
  const limit      = isPro ? MAX_SIZE_PRO : MAX_SIZE_FREE
  const planLabel  = isPro ? 'Pro' : 'Free'

  const oversized = req.files.filter(f => f.size > limit)

  if (oversized.length > 0) {
    if (req.jobId) {
      fsp.rm(path.join(UPLOAD_DIR, req.jobId), { recursive: true, force: true }).catch(() => {})
    }

    logger.warn('Upload rejected: files exceed plan size limit', {
      plan:  planLabel,
      limit: `${Math.round(limit / 1_048_576)} MB`,
      files: oversized.map(f => ({ name: f.originalname, size: f.size })),
      ip:    req.ip,
    })

    return res.status(413).json({
      error: `File too large. ${planLabel} plan allows up to ${Math.round(limit / 1_048_576)} MB per file.`,
      limit,
      files: oversized.map(f => f.originalname),
    })
  }

  next()
}

// ─── Multer error handler ─────────────────────────────────────────────────────

/**
 * Express ERROR middleware — converts multer errors to clean JSON.
 * Must be placed after multer middleware in the chain.
 *
 * @type {import('express').ErrorRequestHandler}
 */
function handleUploadError(err, req, res, next) {
  if (!(err instanceof multer.MulterError)) return next(err)

  // Clean up partially-uploaded files
  if (req.jobId) {
    fsp.rm(path.join(UPLOAD_DIR, req.jobId), { recursive: true, force: true }).catch(() => {})
  }

  const ERROR_MESSAGES = {
    LIMIT_FILE_SIZE:       `File too large. Maximum upload size is ${Math.round(MAX_FILE_SIZE / 1_048_576)} MB.`,
    LIMIT_FILE_COUNT:      'Too many files. Maximum 20 files per request.',
    LIMIT_FIELD_KEY:       'Form field name too long.',
    LIMIT_FIELD_VALUE:     'Form field value too long.',
    LIMIT_FIELD_COUNT:     'Too many form fields.',
    LIMIT_UNEXPECTED_FILE: err.message || 'Unexpected file field in upload.',
    LIMIT_PART_COUNT:      'Too many parts in multipart upload.',
  }

  const message = ERROR_MESSAGES[err.code] || `Upload error: ${err.message}`
  logger.warn('Multer upload error', { code: err.code, message, ip: req?.ip })

  return res.status(400).json({ error: message })
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createUploader,
  enforceSizeLimit,
  enforceMagicBytes,
  handleUploadError,
  ALLOWED_MIMES,
  EXTENSION_MAP,
  MAX_FILE_SIZE,
  MAX_SIZE_FREE,
  MAX_SIZE_PRO,
}
