/**
 * backend/controllers/toolsController.js
 * ─────────────────────────────────────────────────────────────────────────
 * Central dispatcher for every file-processing tool exposed by the API.
 *
 * Responsibilities of this module (and ONLY this module):
 *   1. Look up the requested tool in the TOOL_REGISTRY.
 *   2. Defense-in-depth validation of the uploaded files (category / count).
 *   3. Validate & coerce the `options` payload using the per-tool zod schema.
 *   4. Invoke the correct service function (pdfService / imageService).
 *   5. Persist whatever the service returns (one buffer, or several — in
 *      which case they are zipped) to the job's output directory.
 *   6. Delete the now-unneeded uploaded source files.
 *   7. Return a normalized result object back to the route handler.
 *
 * This module never talks to Express directly (no `req`/`res`) — that
 * keeps it unit-testable and keeps HTTP concerns inside routes/tools.js.
 *
 * Every real processing algorithm (PDF manipulation, image manipulation)
 * lives in backend/services/*.js. This file purely orchestrates.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

const path = require('path')
const fsp = require('fs/promises')

const logger = require('../utils/logger')
const { AppError } = require('../utils/errors')
const { sanitizeFilename } = require('../utils/fileSecurity')
const { validateOptions } = require('../utils/validators')
const { zipBuffers } = require('../utils/archive')

const pdfService = require('../services/pdfService')
const imageService = require('../services/imageService')

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// File extensions accepted for each input "category". Used as a second
// line of defense behind the multer MIME-type filter (middleware/upload.js) —
// belt-and-suspenders so a spoofed MIME type with a mismatched extension
// (or a future change to the upload middleware) can never reach a service
// that assumes a specific binary format.
const CATEGORY_EXTENSIONS = {
  pdf: ['.pdf'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'],
}

/**
 * TOOL_REGISTRY is the single source of truth for which tools this backend
 * actually implements. Every entry maps a public toolId (as used by the
 * frontend / API) to:
 *
 *   - category : which CATEGORY_EXTENSIONS bucket the inputs must belong to
 *   - minFiles : minimum number of uploaded files required
 *   - handler  : async (files, options) => Promise<Array<{ name, buffer }>>
 *
 * Every handler returns an ARRAY of named buffers — even tools that only
 * ever produce a single output file. This uniform contract means this
 * controller never needs tool-specific branching when deciding how to
 * persist the result: one output → save it as-is, multiple outputs → zip.
 *
 * Tools that exist in the frontend catalog but are intentionally NOT
 * implemented by this backend (e.g. Office-document conversion, OCR-driven
 * PDF-to-text/Word/Excel, AI background removal) are simply absent from
 * this map. They fail loudly with a 501 rather than being faked.
 */
const TOOL_REGISTRY = {
  // ── PDF tools ──────────────────────────────────────────────────────────
  'merge-pdf': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) =>
      pdfService.mergePdfs(files.map((f) => f.path)),
  },
  'split-pdf': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.splitPdf(files[0].path, options),
  },
  'rotate-pdf': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.rotatePdf(files[0].path, options),
  },
  'delete-pages': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.deletePages(files[0].path, options),
  },
  'extract-pages': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.extractPages(files[0].path, options),
  },
  'add-watermark': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.addWatermark(files[0].path, options),
  },
  'add-page-numbers': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.addPageNumbers(files[0].path, options),
  },
  'compress-pdf': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.compressPdf(files[0].path, options),
  },
  'protect-pdf': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.protectPdf(files[0].path, options),
  },
  'unlock-pdf': {
    category: 'pdf',
    minFiles: 1,
    handler: (files, options) => pdfService.unlockPdf(files[0].path, options),
  },

  // ── Image → PDF tools ────────────────────────────────────────────────────
  'jpg-to-pdf': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) =>
      imageService.imagesToPdf(files.map((f) => f.path), options),
  },
  'png-to-pdf': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) =>
      imageService.imagesToPdf(files.map((f) => f.path), options),
  },
  'webp-to-pdf': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) =>
      imageService.imagesToPdf(files.map((f) => f.path), options),
  },

  // ── Image tools ──────────────────────────────────────────────────────────
  'resize-image': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) => imageService.resizeImage(files[0].path, options),
  },
  'compress-image': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) =>
      imageService.compressImageBatch(files.map((f) => f.path), options),
  },
  'crop-image': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) => imageService.cropImage(files[0].path, options),
  },
  'rotate-image': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) => imageService.rotateImage(files[0].path, options),
  },
  'flip-image': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) => imageService.flipImage(files[0].path, options),
  },
  'convert-jpg': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) =>
      imageService.convertImageBatch(files.map((f) => f.path), 'jpeg', options),
  },
  'convert-png': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) =>
      imageService.convertImageBatch(files.map((f) => f.path), 'png', options),
  },
  'convert-webp': {
    category: 'image',
    minFiles: 1,
    handler: (files, options) =>
      imageService.convertImageBatch(files.map((f) => f.path), 'webp', options),
  },
}

/**
 * Returns the list of toolIds this backend can actually execute.
 * routes/tools.js uses this as its single source of truth for the
 * `VALID_TOOLS` set instead of maintaining a second, divergent list.
 */
function getAvailableTools() {
  return Object.keys(TOOL_REGISTRY)
}

/**
 * Defense-in-depth check: every uploaded file's extension must belong to
 * the category the chosen tool expects. The multer layer already filters
 * by MIME type, but MIME types are client-supplied and can be spoofed —
 * this catches a mismatched/forged extension before any service module
 * touches the bytes.
 */
function assertFileCategory(toolId, files, category) {
  const allowedExtensions = CATEGORY_EXTENSIONS[category]
  if (!allowedExtensions) {
    // Should never happen — every registry entry must declare a known category.
    throw new AppError(`Tool "${toolId}" has no configured input category.`, 500)
  }

  for (const file of files) {
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      throw new AppError(
        `"${toolId}" does not accept "${ext || 'unknown'}" files. ` +
          `Expected one of: ${allowedExtensions.join(', ')}.`,
        400
      )
    }
  }
}

/**
 * Best-effort removal of the original uploaded files once they have been
 * successfully processed. Failures here are logged but never thrown —
 * a stale temp file is a cleanup-cycle problem (see utils/cleanup.js),
 * not a reason to fail a request whose output has already been produced.
 */
async function cleanupInputFiles(files) {
  await Promise.all(
    files.map(async (file) => {
      try {
        await fsp.unlink(file.path)
      } catch (err) {
        // ENOENT just means it's already gone — anything else is worth a warning.
        if (err.code !== 'ENOENT') {
          logger.warn('Failed to remove uploaded source file', {
            path: file.path,
            error: err.message,
          })
        }
      }
    })
  )
}

/**
 * Persists the handler's output(s) to <UPLOAD_DIR>/<jobId>/output/ and
 * returns the final { name, path } that should be served for download.
 *
 * - A single output is written verbatim under its (sanitized) name.
 * - Multiple outputs are zipped into a single archive, since the existing
 *   download endpoint (GET /api/tools/download/:jobId/:filename) and the
 *   frontend's download() helper both expect exactly one downloadable file
 *   per job.
 */
async function persistOutputs(outputs, toolId, jobId, outputDir) {
  await fsp.mkdir(outputDir, { recursive: true })

  let finalName
  let finalBuffer

  if (outputs.length === 1) {
    finalName = sanitizeFilename(outputs[0].name)
    finalBuffer = outputs[0].buffer
  } else {
    finalName = `${toolId}-${jobId.slice(0, 8)}.zip`
    finalBuffer = await zipBuffers(
      outputs.map((o) => ({ name: sanitizeFilename(o.name), buffer: o.buffer }))
    )
  }

  const outputPath = path.join(outputDir, finalName)
  await fsp.writeFile(outputPath, finalBuffer)

  return { outputPath, outputName: finalName }
}

/**
 * Process a single tool request end-to-end.
 *
 * @param {string} toolId      - e.g. 'merge-pdf', 'resize-image'
 * @param {Array}  files       - multer file objects (req.files)
 * @param {Object} rawOptions  - unvalidated options parsed from the request body
 * @param {string} jobId       - UUID assigned to this upload by the upload middleware;
 *                                also the name of the directory the files live in.
 *
 * @returns {Promise<{
 *   jobId: string,
 *   outputFile: string,
 *   outputPath: string,
 *   outputSize: number,
 *   processingMs: number,
 *   toolId: string,
 *   inputFiles: Array<{ name: string, size: number }>,
 *   options: Object,
 * }>}
 *
 * @throws {AppError} with an appropriate HTTP status code on any failure.
 */
async function processTool(toolId, files, rawOptions = {}, jobId) {
  const startedAt = Date.now()

  if (!jobId) {
    // Every upload is assigned a jobId by middleware/upload.js before this
    // function is ever called — if it's missing, something upstream is broken.
    throw new AppError('Missing job identifier for this upload.', 500)
  }

  if (!files || files.length === 0) {
    throw new AppError('No files were provided for processing.', 400)
  }

  const registryEntry = TOOL_REGISTRY[toolId]
  if (!registryEntry) {
    throw new AppError(
      `The "${toolId}" tool is not available in this deployment.`,
      501
    )
  }

  if (files.length < registryEntry.minFiles) {
    throw new AppError(
      `"${toolId}" requires at least ${registryEntry.minFiles} file(s), received ${files.length}.`,
      400
    )
  }

  assertFileCategory(toolId, files, registryEntry.category)

  // Validate + coerce the options payload (string → number/boolean, defaults,
  // enum membership, password length, page-range syntax, etc). Throws
  // AppError(400, …) on invalid input — see utils/validators.js.
  const options = validateOptions(toolId, rawOptions)

  logger.info('Dispatching tool', {
    toolId,
    jobId,
    fileCount: files.length,
    files: files.map((f) => f.originalname),
  })

  let outputs
  try {
    outputs = await registryEntry.handler(files, options)
  } catch (err) {
    if (err instanceof AppError) throw err

    // Unexpected errors thrown by pdf-lib/sharp/etc. (corrupt file, wrong
    // password, unsupported encoding, ...) are surfaced as 422 — the
    // request was well-formed but the file/content could not be processed.
    logger.error('Tool handler threw an unexpected error', {
      toolId,
      jobId,
      error: err.message,
      stack: err.stack,
    })
    throw new AppError(
      `Could not process this file with "${toolId}": ${err.message}`,
      422
    )
  }

  if (!Array.isArray(outputs) || outputs.length === 0) {
    logger.error('Tool handler returned no output', { toolId, jobId })
    throw new AppError('Processing completed but produced no output file.', 500)
  }

  const outputDir = path.join(UPLOAD_DIR, jobId, 'output')
  const { outputPath, outputName } = await persistOutputs(
    outputs,
    toolId,
    jobId,
    outputDir
  )

  // The originals are no longer needed — the output has been written to disk.
  await cleanupInputFiles(files)

  const stat = await fsp.stat(outputPath)
  const processingMs = Date.now() - startedAt

  logger.info('Tool processed successfully', {
    toolId,
    jobId,
    outputFile: outputName,
    outputSize: stat.size,
    processingMs,
  })

  return {
    jobId,
    outputFile: outputName,
    outputPath,
    outputSize: stat.size,
    processingMs,
    toolId,
    inputFiles: files.map((f) => ({ name: f.originalname, size: f.size })),
    options,
  }
}

module.exports = { processTool, getAvailableTools }
