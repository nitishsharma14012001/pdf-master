/**
 * backend/utils/archive.js
 * ─────────────────────────────────────────────────────────────────────────
 * Zip-archive helpers used whenever a tool produces more than one output
 * file (e.g. "Split PDF → every page", or batch image conversion across
 * several uploaded files). The existing download endpoint and frontend
 * download() helper both expect exactly one file per completed job, so
 * multi-file results get bundled into a single .zip before being handed
 * back to the controller.
 *
 * Two helpers are exported:
 *
 *   - zipBuffers(entries)            : entries already live in memory as
 *                                       Buffers (this is what the PDF/image
 *                                       services in this project produce).
 *                                       The ZIP itself is still streamed
 *                                       and compressed incrementally by
 *                                       `archiver` — entries are not
 *                                       duplicated in memory beyond the
 *                                       buffers already passed in.
 *
 *   - zipFilesToPath(files, dest)    : entries live on disk as file paths.
 *                                       Every byte streams straight from
 *                                       disk, through the deflate
 *                                       compressor, to the destination
 *                                       file — nothing is ever held in the
 *                                       Node.js heap. Prefer this path for
 *                                       any future service that writes
 *                                       intermediate results to temp files
 *                                       rather than buffers, since it is
 *                                       the most memory-efficient option.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

const fs = require('fs')
const archiver = require('archiver')
const { PassThrough } = require('stream')

const logger = require('./logger')
const { AppError } = require('./errors')

/**
 * Guarantees every entry going into an archive has a unique name by
 * appending `_1`, `_2`, … before the extension on collision. Protects
 * against silently overwriting one output with another inside the zip if
 * two source files happened to produce the same output name.
 */
function ensureUniqueName(name, usedNames) {
  const safeBase = name && typeof name === 'string' ? name : 'file'
  let candidate = safeBase
  let counter = 1

  const dotIndex = safeBase.lastIndexOf('.')
  const stem = dotIndex > 0 ? safeBase.slice(0, dotIndex) : safeBase
  const ext = dotIndex > 0 ? safeBase.slice(dotIndex) : ''

  while (usedNames.has(candidate)) {
    candidate = `${stem}_${counter}${ext}`
    counter += 1
  }

  usedNames.add(candidate)
  return candidate
}

/**
 * Zips a list of in-memory buffers into a single in-memory zip Buffer.
 *
 * @param {Array<{ name: string, buffer: Buffer }>} entries
 * @returns {Promise<Buffer>}
 */
async function zipBuffers(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw AppError.internal('zipBuffers() was called with no entries to archive.')
  }

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks = []
    const collector = new PassThrough()

    collector.on('data', (chunk) => chunks.push(chunk))
    collector.on('end', () => resolve(Buffer.concat(chunks)))
    collector.on('error', (err) => reject(err))

    archive.on('warning', (err) => {
      // Archiver emits "warnings" for things like a missing stat on a
      // virtual entry — these are non-fatal but worth logging.
      logger.warn('Archiver warning while building zip', { error: err.message })
    })
    archive.on('error', (err) => reject(err))

    archive.pipe(collector)

    const usedNames = new Set()
    for (const entry of entries) {
      const safeName = ensureUniqueName(entry.name, usedNames)
      archive.append(entry.buffer, { name: safeName })
    }

    // Errors during finalization surface through the 'error' event handler
    // registered above, not through this call's return value.
    archive.finalize()
  })
}

/**
 * Zips a list of on-disk files directly into a destination .zip file,
 * streaming the whole way through — no intermediate buffering of file
 * contents in process memory.
 *
 * @param {Array<{ name: string, path: string }>} files
 * @param {string} destinationZipPath
 * @returns {Promise<string>} resolves with `destinationZipPath`
 */
async function zipFilesToPath(files, destinationZipPath) {
  if (!Array.isArray(files) || files.length === 0) {
    throw AppError.internal('zipFilesToPath() was called with no files to archive.')
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destinationZipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve(destinationZipPath))
    output.on('error', (err) => reject(err))

    archive.on('warning', (err) => {
      logger.warn('Archiver warning while building zip', { error: err.message })
    })
    archive.on('error', (err) => reject(err))

    archive.pipe(output)

    const usedNames = new Set()
    for (const file of files) {
      const safeName = ensureUniqueName(file.name, usedNames)
      archive.file(file.path, { name: safeName })
    }

    archive.finalize()
  })
}

module.exports = { zipBuffers, zipFilesToPath }
