'use strict'

/**
 * PDF Master — routes/tools.js
 *
 * API surface for all file-processing tools.
 *
 * POST /api/tools/:toolId/process   → upload files + options, get back a download URL
 * GET  /api/tools/download/:jobId/:filename → stream the processed file
 * DELETE /api/tools/jobs/:jobId     → explicitly delete a job directory
 * GET  /api/tools                   → tool catalog
 *
 * Security hardening applied at every layer:
 *   - UUID v4 regex enforced on every jobId parameter (prevents path traversal)
 *   - Filename sanitised to alphanumerics + safe punctuation before serving
 *   - Resolved file path asserted to be inside UPLOAD_DIR (double-check)
 *   - MIME type sniffed from actual file for Content-Type header
 *   - Per-tool maximum file count enforced before processing begins
 *   - Zod ValidationError formatted into human-readable field messages
 *   - Upload temp files deleted after a successful download (opt-in via env flag)
 */

const router  = require('express').Router()
const path    = require('path')
const fs      = require('fs')
const fsp     = require('fs/promises')
const { z }   = require('zod')

const { createUploader, enforceSizeLimit, enforceMagicBytes, handleUploadError } = require('../middleware/upload')
const { optionalAuth }  = require('../middleware/auth')
const { processTool, getAvailableTools } = require('../controllers/toolsController')
const logger            = require('../utils/logger')
const { AppError }      = require('../utils/errors')

// ── Config ────────────────────────────────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// Delete the input + output files after the processed file has been downloaded.
// Set DELETE_AFTER_DOWNLOAD=true in .env to enable. Defaults to false so that
// users can download multiple times within the TTL window.
const DELETE_AFTER_DOWNLOAD = process.env.DELETE_AFTER_DOWNLOAD === 'true'

// ── Multer instance ───────────────────────────────────────────────────────────
// Global maximum: 20 files per request. Per-tool limits are enforced below.
const upload = createUploader(20)

// ── Tool registry ─────────────────────────────────────────────────────────────
//
// Each entry maps a toolId to:
//   minFiles  — minimum number of uploaded files required
//   maxFiles  — maximum number of uploaded files accepted
//   accept    — array of MIME type categories ('pdf' | 'image' | 'office')
//               matched against the ALLOWED_MIMES map in upload middleware
//
// Tools not listed here are rejected with 404.

const IMPLEMENTED_TOOL_IDS = new Set(getAvailableTools())

const TOOL_CONFIG = {
  // Image -> PDF
  'jpg-to-pdf':        { minFiles: 1, maxFiles: 20, accept: ['image'] },
  'png-to-pdf':        { minFiles: 1, maxFiles: 20, accept: ['image'] },
  'webp-to-pdf':       { minFiles: 1, maxFiles: 20, accept: ['image'] },

  // Image editing
  'resize-image':      { minFiles: 1, maxFiles: 1,  accept: ['image'] },
  'compress-image':    { minFiles: 1, maxFiles: 20, accept: ['image'] },
  'crop-image':        { minFiles: 1, maxFiles: 1,  accept: ['image'] },
  'rotate-image':      { minFiles: 1, maxFiles: 1,  accept: ['image'] },
  'flip-image':        { minFiles: 1, maxFiles: 1,  accept: ['image'] },

  // Image format conversion
  'convert-jpg':       { minFiles: 1, maxFiles: 20, accept: ['image'] },
  'convert-png':       { minFiles: 1, maxFiles: 20, accept: ['image'] },
  'convert-webp':      { minFiles: 1, maxFiles: 20, accept: ['image'] },

  // PDF manipulation
  'merge-pdf':         { minFiles: 2, maxFiles: 20, accept: ['pdf'] },
  'split-pdf':         { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
  'rotate-pdf':        { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
  'delete-pages':      { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
  'extract-pages':     { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
  'add-watermark':     { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
  'add-page-numbers':  { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
  'compress-pdf':      { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
  'protect-pdf':       { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
  'unlock-pdf':        { minFiles: 1, maxFiles: 1,  accept: ['pdf'] },
}

// Flat Set of valid tool IDs (used by the catalog endpoint)
const VALID_TOOLS = new Set(Object.keys(TOOL_CONFIG).filter((id) => IMPLEMENTED_TOOL_IDS.has(id)))

// MIME type → category map (must stay in sync with middleware/upload.js)
const MIME_CATEGORY = {
  'application/pdf':   'pdf',
  'image/jpeg':        'image',
  'image/png':         'image',
  'image/webp':        'image',
  'image/gif':         'image',
  'image/bmp':         'image',
  'image/tiff':        'image',
  'application/msword': 'office',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'office',
  'application/vnd.ms-excel': 'office',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'office',
  'application/vnd.ms-powerpoint': 'office',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'office',
}

// ── Validation helpers ────────────────────────────────────────────────────────

// UUID v4 pattern — used to validate jobId path params
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Safe filename characters: alphanumerics, dash, underscore, dot, space
// Everything else is stripped before the filename is used in a Content-Disposition header.
const SAFE_FILENAME_RE = /[^a-zA-Z0-9._\- ]/g

/**
 * Assert that a resolved file path is strictly inside UPLOAD_DIR.
 * Throws if the path escapes (path-traversal guard — belt and braces).
 */
function assertInsideUploadDir(resolvedPath) {
  const uploadRoot = path.resolve(UPLOAD_DIR)
  if (!resolvedPath.startsWith(uploadRoot + path.sep)) {
    throw new Object.assign(new Error('Path outside upload directory'), { status: 400 })
  }
}

/**
 * Format a ZodError into a human-readable string listing every invalid field.
 */
function formatZodError(zodErr) {
  return zodErr.errors
    .map(e => `${e.path.join('.') || 'options'}: ${e.message}`)
    .join('; ')
}

/**
 * Validate that the uploaded files match the tool's accepted MIME categories.
 * Returns an error message string on failure, null on success.
 */
function validateFileTypes(files, acceptedCategories) {
  const rejected = files.filter(f => !acceptedCategories.includes(MIME_CATEGORY[f.mimetype]))
  if (rejected.length === 0) return null
  const names = rejected.map(f => `${f.originalname} (${f.mimetype})`).join(', ')
  return `File type not accepted by this tool: ${names}`
}

// ── MIME type map for download Content-Type ───────────────────────────────────
const EXT_TO_MIME = {
  '.pdf':  'application/pdf',
  '.zip':  'application/zip',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.bmp':  'image/bmp',
  '.txt':  'text/plain',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/tools
 * Return the full tool catalog with configuration metadata.
 */
router.get('/', (req, res) => {
  const catalog = Object.entries(TOOL_CONFIG).map(([id, cfg]) => ({
    id,
    minFiles: cfg.minFiles,
    maxFiles: cfg.maxFiles,
    accept:   cfg.accept,
  }))
  res.json({ tools: catalog, count: catalog.length })
})

/**
 * POST /api/tools/:toolId/process
 *
 * Accepts multipart/form-data with:
 *   files   — one or more files in the "files" field
 *   options — optional JSON string with tool-specific parameters
 *
 * Returns JSON:
 *   { success, jobId, outputFile, outputSize, processingMs, downloadUrl, expiresAt }
 */
router.post(
  '/:toolId/process',
  optionalAuth,           // populates req.user when a valid JWT is present
  upload.array('files', 20),
  handleUploadError,      // catches multer errors before they reach the async handler
  enforceMagicBytes,      // verifies uploaded bytes match the declared file type
  enforceSizeLimit,       // enforces per-plan file-size caps
  async (req, res) => {
    const { toolId } = req.params

    // ── 1. Tool existence check ───────────────────────────────────────────────
    if (!TOOL_CONFIG[toolId]) {
      return res.status(404).json({
        error: `Unknown tool: "${toolId}". GET /api/tools for a list of valid tool IDs.`,
      })
    }

    if (!IMPLEMENTED_TOOL_IDS.has(toolId)) {
      return res.status(501).json({
        error: `The "${toolId}" tool is not available in this deployment.`,
      })
    }

    const cfg = TOOL_CONFIG[toolId]

    // ── 2. File presence check ────────────────────────────────────────────────
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' })
    }

    // ── 3. Per-tool file count enforcement ────────────────────────────────────
    if (req.files.length < cfg.minFiles) {
      return res.status(400).json({
        error: `${toolId} requires at least ${cfg.minFiles} file(s); received ${req.files.length}.`,
      })
    }
    if (req.files.length > cfg.maxFiles) {
      return res.status(400).json({
        error: `${toolId} accepts at most ${cfg.maxFiles} file(s); received ${req.files.length}.`,
      })
    }

    // ── 4. MIME category check ────────────────────────────────────────────────
    const mimeError = validateFileTypes(req.files, cfg.accept)
    if (mimeError) {
      return res.status(415).json({ error: mimeError })
    }

    // ── 5. Parse options ──────────────────────────────────────────────────────
    let options = {}
    if (req.body.options) {
      try {
        options = JSON.parse(req.body.options)
        if (typeof options !== 'object' || Array.isArray(options)) {
          return res.status(400).json({ error: '"options" must be a JSON object.' })
        }
      } catch (_) {
        return res.status(400).json({ error: '"options" is not valid JSON.' })
      }
    }

    logger.info('Tool request received', {
      toolId,
      fileCount: req.files.length,
      files:     req.files.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })),
      user:      req.user?.email || 'anonymous',
      ip:        req.ip,
    })

    // ── 6. Process ────────────────────────────────────────────────────────────
    // ── 6. Process ────────────────────────────────────────────
try {
  const result = await processTool(
    toolId,
    req.files,
    options,
    req.jobId
  );

  const downloadUrl = `/api/tools/download/${result.jobId}/${encodeURIComponent(result.outputFile)}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();  // 1 hour

      logger.info('Tool succeeded', {
        toolId,
        jobId:        result.jobId,
        outputFile:   result.outputFile,
        outputSize:   result.outputSize,
        processingMs: result.processingMs,
      })

      return res.status(200).json({
        success:      true,
        jobId:        result.jobId,
        outputFile:   result.outputFile,
        outputSize:   result.outputSize,
        processingMs: result.processingMs,
        downloadUrl,
        expiresAt,
      })
    } catch (err) {
      if (err?.isOperational) {
        return res.status(err.statusCode || 400).json({
          error: err.message,
          details: err.details,
        })
      }

      // ZodError → 400 with field-level detail
      if (err?.constructor?.name === 'ZodError' || err?.name === 'ZodError') {
        logger.warn('Validation error in tool options', { toolId, issues: err.errors })
        return res.status(400).json({ error: formatZodError(err) })
      }

      // Known user errors (bad password, no pages, etc.) → 422
      const userErrorPatterns = [
        'password', 'incorrect', 'page', 'range', 'encrypt', 'unlock',
        'at least', 'cannot delete all', 'no valid', 'no pages', 'could not process',
      ]
      const isUserError = userErrorPatterns.some(p => err.message?.toLowerCase().includes(p))

      if (isUserError) {
        logger.warn('Tool processing rejected by user input', { toolId, error: err.message })
        return res.status(422).json({ error: err.message })
      }

      // Unexpected server error → 500
      logger.error('Tool processing failed', {
        toolId,
        error: err.message,
        stack: err.stack,
        files: req.files?.map(f => f.originalname),
      })
      return res.status(500).json({
        error: process.env.NODE_ENV === 'production'
          ? 'An error occurred while processing your file. Please try again.'
          : err.message,
      })
    }
  }
)

/**
 * GET /api/tools/download/:jobId/:filename
 *
 * Stream the processed output file to the client.
 *
 * Security:
 *   - jobId validated as UUID v4
 *   - filename sanitised (no path separators, no ..)
 *   - resolved path asserted inside UPLOAD_DIR
 *   - Content-Type set from extension map (never from user input)
 *   - Content-Disposition set to attachment (forces download, not inline execution)
 */
router.get('/download/:jobId/:filename', async (req, res) => {
  const { jobId, filename } = req.params

  // Validate jobId is a proper UUID v4 (prevents directory traversal via jobId)
  if (!UUID_RE.test(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID format.' })
  }

  // Sanitise filename — strip anything outside safe characters
  const safeFilename = decodeURIComponent(filename).replace(SAFE_FILENAME_RE, '_')

  // Reject if sanitised name is empty or still contains traversal sequences
  if (!safeFilename || safeFilename.includes('..') || safeFilename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename.' })
  }

  const filePath = path.resolve(UPLOAD_DIR, jobId, 'output', safeFilename)

  // Belt-and-braces: assert the resolved path is inside UPLOAD_DIR
  try {
    assertInsideUploadDir(filePath)
  } catch (_) {
    return res.status(400).json({ error: 'Invalid file path.' })
  }

  // Check existence before attempting to stream
  try {
    await fsp.access(filePath, fs.constants.R_OK)
  } catch (_) {
    return res.status(404).json({ error: 'File not found or has already expired.' })
  }

  // Determine Content-Type from extension (never trust user-supplied MIME)
  const ext         = path.extname(safeFilename).toLowerCase()
  const contentType = EXT_TO_MIME[ext] || 'application/octet-stream'

  // Get file size for Content-Length header (enables progress bars in clients)
  let fileSize
  try {
    const stat = await fsp.stat(filePath)
    fileSize   = stat.size
  } catch (_) {
    return res.status(500).json({ error: 'Could not read output file.' })
  }

  logger.info('File download started', {
    jobId,
    filename: safeFilename,
    size:     fileSize,
    ip:       req.ip,
  })

  // Set headers
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Length', fileSize)
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
  res.setHeader('Cache-Control', 'no-store')         // processed files are user-specific
  res.setHeader('X-Content-Type-Options', 'nosniff') // honour our Content-Type, don't sniff

  // Stream the file — avoids loading the entire output into memory
  const readStream = fs.createReadStream(filePath)

  readStream.on('error', (err) => {
    logger.error('Stream error during download', { filePath, error: err.message })
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download stream failed.' })
    } else {
      res.destroy()
    }
  })

  readStream.on('close', async () => {
    logger.info('File download complete', { jobId, filename: safeFilename })

    // Optional: delete the entire job directory after successful download
    if (DELETE_AFTER_DOWNLOAD) {
      const jobDir = path.resolve(UPLOAD_DIR, jobId)
      try {
        await fsp.rm(jobDir, { recursive: true, force: true })
        logger.debug('Job directory deleted after download', { jobId })
      } catch (rmErr) {
        logger.warn('Could not delete job directory after download', {
          jobId,
          error: rmErr.message,
        })
      }
    }
  })

  readStream.pipe(res)
})

/**
 * DELETE /api/tools/jobs/:jobId
 *
 * Explicitly delete all files associated with a job before the TTL expires.
 * Useful for clients that want to clean up immediately after download.
 */
router.delete('/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params

  if (!UUID_RE.test(jobId)) {
    return res.status(400).json({ error: 'Invalid job ID format.' })
  }

  const jobDir = path.resolve(UPLOAD_DIR, jobId)

  // Confirm it's inside UPLOAD_DIR before deleting
  const uploadRoot = path.resolve(UPLOAD_DIR)
  if (!jobDir.startsWith(uploadRoot + path.sep)) {
    return res.status(400).json({ error: 'Invalid job path.' })
  }

  try {
    const exists = await fsp.access(jobDir).then(() => true).catch(() => false)
    if (exists) {
      await fsp.rm(jobDir, { recursive: true, force: true })
      logger.info('Job deleted by client request', { jobId, ip: req.ip })
    }
    res.json({ success: true, jobId })
  } catch (err) {
    logger.error('Failed to delete job directory', { jobId, error: err.message })
    res.status(500).json({ error: 'Could not delete job.' })
  }
})

module.exports = router
