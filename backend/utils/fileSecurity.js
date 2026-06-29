/**
 * backend/utils/fileSecurity.js
 * ─────────────────────────────────────────────────────────────────────────
 * Security helpers shared by the upload middleware, controller, and
 * services. Three concerns live here:
 *
 *   1. Filename sanitization — turning an arbitrary, attacker-controlled
 *      string (the original upload name, or a name we are about to write
 *      to disk / put in a Content-Disposition header) into something that
 *      cannot escape its directory, inject control characters, or collide
 *      with reserved names.
 *
 *   2. Path-traversal-safe joins — guaranteeing that a path built from a
 *      user-supplied segment (jobId, filename, …) can never resolve to
 *      somewhere outside the directory it was supposed to live in.
 *
 *   3. Real content verification — checking that a file's *actual bytes*
 *      match the category it claims to be (PDF magic number, or a
 *      successfully-decodable image), rather than trusting the
 *      client-supplied MIME type and extension alone. A MIME type is just
 *      a request header; an attacker fully controls it.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

const path = require('path')
const fsp = require('fs/promises')
const sharp = require('sharp')

const { AppError } = require('./errors')

// Windows/legacy reserved device names — never allow these as a filename
// on disk regardless of platform, since the output may later be copied
// onto a Windows host (CI runners, shared drives, etc).
const RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
])

const MAX_FILENAME_LENGTH = 180

/**
 * Reduces an arbitrary (possibly hostile) filename to a safe one that:
 *   - has no directory components (no `/`, `\`, or `..`)
 *   - contains only letters, digits, underscore, hyphen, dot, and space
 *   - never starts with a dot (hidden file) or hyphen (could be parsed as
 *     a CLI flag by a downstream tool invoked with this name)
 *   - keeps its original extension, lower-cased
 *   - is never empty and never a Windows-reserved device name
 *   - is capped to a sane length so it can't blow filesystem limits
 *
 * This is intentionally conservative — favoring obviously-safe characters
 * over preserving every possible legitimate Unicode filename.
 */
function sanitizeFilename(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return `file_${Date.now()}`
  }

  // Strip any directory component an attacker might smuggle in
  // (e.g. "../../etc/passwd", "C:\\Windows\\win.ini").
  const baseName = path.basename(rawName).replace(/\\/g, '/')
  const noTraversal = path.basename(baseName)

  const ext = path.extname(noTraversal).toLowerCase().replace(/[^a-z0-9.]/g, '')
  let stem = noTraversal.slice(0, noTraversal.length - ext.length)

  // Replace anything that isn't a safe character with an underscore.
  stem = stem.replace(/[^a-zA-Z0-9_\- ]/g, '_')

  // Collapse repeated separators/whitespace and trim leading dots/hyphens.
  stem = stem.replace(/\s+/g, ' ').trim()
  stem = stem.replace(/^[.\-]+/, '')

  if (!stem) stem = 'file'
  if (RESERVED_NAMES.has(stem.toUpperCase())) stem = `${stem}_file`

  let safeName = `${stem}${ext}`

  if (safeName.length > MAX_FILENAME_LENGTH) {
    const keep = MAX_FILENAME_LENGTH - ext.length
    safeName = `${stem.slice(0, Math.max(keep, 1))}${ext}`
  }

  return safeName
}

/**
 * Joins `untrustedSegment` onto `baseDir` and guarantees the resolved,
 * absolute path is still located inside `baseDir`. Throws an AppError
 * (400) if the resolved path would escape the base directory — this is
 * the canonical defense against path-traversal via `..` segments,
 * absolute-path injection, or null-byte tricks.
 *
 * Always use this (never a raw `path.join`) whenever a path segment came
 * from the network: a jobId, a filename, a query/body/param value.
 */
function safeJoin(baseDir, ...untrustedSegments) {
  const resolvedBase = path.resolve(baseDir)

  // Reject embedded NUL bytes outright — some filesystems / native APIs
  // truncate strings at \0, which can be abused to bypass extension checks.
  for (const segment of untrustedSegments) {
    if (typeof segment === 'string' && segment.includes('\0')) {
      throw AppError.badRequest('Invalid path segment.')
    }
  }

  const resolvedTarget = path.resolve(resolvedBase, ...untrustedSegments)

  const isInside =
    resolvedTarget === resolvedBase ||
    resolvedTarget.startsWith(resolvedBase + path.sep)

  if (!isInside) {
    throw AppError.badRequest('Resolved path escapes the allowed directory.')
  }

  return resolvedTarget
}

/**
 * Returns the lower-cased extension (including the leading dot) of a
 * filename, or '' if there isn't one.
 */
function getExtension(filename) {
  return path.extname(filename || '').toLowerCase()
}

/**
 * Validates that `filename`'s extension is one of `allowedExtensions`
 * (an array like ['.pdf'] or ['.jpg', '.jpeg', '.png']).
 */
function assertAllowedExtension(filename, allowedExtensions) {
  const ext = getExtension(filename)
  if (!allowedExtensions.includes(ext)) {
    throw AppError.badRequest(
      `Unsupported file extension "${ext || '(none)'}". Expected: ${allowedExtensions.join(', ')}.`
    )
  }
  return ext
}

/**
 * Reads the first few bytes of a file and confirms they match the PDF
 * magic number ("%PDF-"). The PDF header is allowed to be preceded by a
 * small amount of junk per the spec (some generators prepend a BOM or
 * comment), so we scan the first 1KB rather than requiring byte 0.
 */
async function looksLikePdf(filePath) {
  const handle = await fsp.open(filePath, 'r')
  try {
    const { buffer, bytesRead } = await handle.read({
      buffer: Buffer.alloc(1024),
      position: 0,
    })
    const header = buffer.subarray(0, bytesRead).toString('latin1')
    return header.includes('%PDF-')
  } finally {
    await handle.close()
  }
}

/**
 * Confirms a file is a genuinely decodable raster image by asking sharp
 * to read its metadata. This is far stronger than trusting the extension
 * or MIME type: sharp (via libvips) parses the actual image container, so
 * a non-image file renamed to ".png" will fail here even though both its
 * extension and a spoofed Content-Type header could claim otherwise.
 */
async function looksLikeImage(filePath) {
  try {
    const metadata = await sharp(filePath).metadata()
    return Boolean(metadata && metadata.format && metadata.width && metadata.height)
  } catch {
    return false
  }
}

/**
 * Verifies that the file at `filePath` is genuinely a member of
 * `category` ('pdf' | 'image') by inspecting its actual content rather
 * than relying on the client-supplied extension/MIME type. Throws a 422
 * AppError (the request was well-formed, but the file's content doesn't
 * match what was claimed) when the check fails.
 */
async function verifyFileSignature(filePath, category) {
  let valid
  if (category === 'pdf') {
    valid = await looksLikePdf(filePath)
  } else if (category === 'image') {
    valid = await looksLikeImage(filePath)
  } else {
    throw AppError.internal(`Unknown file category "${category}" for signature check.`)
  }

  if (!valid) {
    throw AppError.unprocessable(
      category === 'pdf'
        ? 'This file does not appear to be a valid PDF.'
        : 'This file does not appear to be a valid, decodable image.'
    )
  }

  return true
}

module.exports = {
  sanitizeFilename,
  safeJoin,
  getExtension,
  assertAllowedExtension,
  verifyFileSignature,
}
