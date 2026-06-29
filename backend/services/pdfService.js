/**
 * backend/services/pdfService.js
 * ─────────────────────────────────────────────────────────────────────────
 * Real PDF-manipulation implementations backing every "PDF Tool" in the
 * frontend catalog, built on `pdf-lib`.
 *
 * Every exported function follows the same contract used throughout this
 * backend: it returns `Promise<Array<{ name: string, buffer: Buffer }>>` —
 * even tools that only ever produce one output file. The controller
 * decides whether to save a single output as-is or zip multiple outputs
 * together.
 *
 * Honesty notes on the two hardest tools here, since both push past
 * pdf-lib's officially documented surface:
 *
 *   - compressPdf walks the document's actual embedded image XObjects and
 *     recompresses them with sharp. It only touches images it can decode
 *     with full confidence (plain JPEG streams, or simple 8-bit
 *     DeviceGray/DeviceRGB raw streams with no soft mask/indexed palette/
 *     decode array) and leaves everything else byte-for-byte untouched —
 *     "best effort", never "best guess". It also never returns a file
 *     larger than the original.
 *
 *   - protectPdf / unlockPdf implement the actual PDF Standard Security
 *     Handler (see utils/pdfCrypto.js) and apply it by walking pdf-lib's
 *     low-level object graph directly, because pdf-lib has no encryption
 *     API of its own. The cryptography itself is verified (see
 *     pdfCrypto.js); this file's job is correctly wiring that math into
 *     pdf-lib's PDFContext.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

const path = require('path')
const fsp = require('fs/promises')
const zlib = require('zlib')
const crypto = require('crypto')
const sharp = require('sharp')

const {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PDFDict,
  PDFArray,
  PDFName,
  PDFNumber,
  PDFHexString,
  PDFRawStream,
  PDFRef,
} = require('pdf-lib')

const { AppError } = require('../utils/errors')
const logger = require('../utils/logger')
const pdfCrypto = require('./pdfCrypto');
const {
  parsePageSelection,
  complementIndices,
  chunkPagesEvery,
  allPageIndices,
} = require('../utils/pageRanges')

/** Returns a file's name without its extension. */
function baseName(filePath) {
  return path.basename(filePath, path.extname(filePath))
}

/**
 * Loads a PDF's bytes into a pdf-lib document, converting any parse
 * failure (corrupt file, not actually a PDF despite the extension, an
 * unexpectedly-encrypted file fed to a tool that doesn't expect one) into
 * a clear, user-facing 422 error instead of an opaque pdf-lib exception.
 */
async function loadPdfDocument(bytes, filePath) {
  try {
    return await PDFDocument.load(bytes)
  } catch (err) {
    throw AppError.unprocessable(
      `"${path.basename(filePath)}" could not be read — it may be corrupted, not a valid PDF, ` +
        `or password-protected (try Unlock PDF first). ${err.message}`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Merge / Split
// ─────────────────────────────────────────────────────────────────────────

/**
 * Merges one or more PDFs, in the order given, into a single document.
 * @param {string[]} filePaths
 */
async function mergePdfs(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    throw AppError.badRequest('At least one PDF is required.')
  }

  const mergedDoc = await PDFDocument.create()

  for (const filePath of filePaths) {
    const srcBytes = await fsp.readFile(filePath)
    const srcDoc = await loadPdfDocument(srcBytes, filePath)
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => mergedDoc.addPage(page))
  }

  const outBytes = await mergedDoc.save()
  return [{ name: `merged-${Date.now()}.pdf`, buffer: Buffer.from(outBytes) }]
}

/**
 * Splits a PDF according to `options.mode`:
 *   - 'all'   → one output file per page
 *   - 'range' → a single output file containing exactly `options.range`
 *   - 'every' → one output file per consecutive chunk of `options.every` pages
 *
 * @param {string} filePath
 * @param {{ mode: 'all'|'range'|'every', range?: string, every?: number }} options
 */
async function splitPdf(filePath, options) {
  const { mode, range, every } = options
  const srcBytes = await fsp.readFile(filePath)
  const srcDoc = await loadPdfDocument(srcBytes, filePath)
  const totalPages = srcDoc.getPageCount()
  const name = baseName(filePath)

  let groups
  if (mode === 'range') {
    groups = [parsePageSelection(range, totalPages)]
  } else if (mode === 'every') {
    groups = chunkPagesEvery(totalPages, every)
  } else {
    groups = allPageIndices(totalPages).map((index) => [index])
  }

  const results = []
  for (let i = 0; i < groups.length; i++) {
    const newDoc = await PDFDocument.create()
    const copiedPages = await newDoc.copyPages(srcDoc, groups[i])
    copiedPages.forEach((page) => newDoc.addPage(page))
    const bytes = await newDoc.save()

    const label = mode === 'range' ? 'extracted' : `part-${i + 1}-of-${groups.length}`
    results.push({ name: `${name}_${label}.pdf`, buffer: Buffer.from(bytes) })
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────
// Rotate / Delete / Extract
// ─────────────────────────────────────────────────────────────────────────

/**
 * Rotates the selected pages (or every page, if `pages` is blank) by a
 * fixed angle, additive to whatever rotation each page already has.
 *
 * @param {string} filePath
 * @param {{ angle: number, pages?: string }} options
 */
async function rotatePdf(filePath, options) {
  const { angle, pages } = options
  const bytes = await fsp.readFile(filePath)
  const doc = await loadPdfDocument(bytes, filePath)
  const totalPages = doc.getPageCount()

  const indices = parsePageSelection(pages, totalPages)
  const allPages = doc.getPages()

  for (const index of indices) {
    const page = allPages[index]
    const current = page.getRotation().angle
    const next = ((current + angle) % 360 + 360) % 360
    page.setRotation(degrees(next))
  }

  const outBytes = await doc.save()
  return [{ name: `${baseName(filePath)}_rotated.pdf`, buffer: Buffer.from(outBytes) }]
}

/**
 * Removes the selected pages by keeping their complement (every page
 * NOT in the selection) in a brand-new document.
 *
 * @param {string} filePath
 * @param {{ pages: string }} options
 */
async function deletePages(filePath, options) {
  const { pages } = options
  const bytes = await fsp.readFile(filePath)
  const srcDoc = await loadPdfDocument(bytes, filePath)
  const totalPages = srcDoc.getPageCount()

  const toDelete = parsePageSelection(pages, totalPages)
  const toKeep = complementIndices(toDelete, totalPages)

  if (toKeep.length === 0) {
    throw AppError.badRequest('Cannot delete every page — the resulting PDF would be empty.')
  }

  const newDoc = await PDFDocument.create()
  const copiedPages = await newDoc.copyPages(srcDoc, toKeep)
  copiedPages.forEach((page) => newDoc.addPage(page))

  const outBytes = await newDoc.save()
  return [{ name: `${baseName(filePath)}_pages-deleted.pdf`, buffer: Buffer.from(outBytes) }]
}

/**
 * Extracts the selected pages into a brand-new document, discarding
 * everything else.
 *
 * @param {string} filePath
 * @param {{ pages: string }} options
 */
async function extractPages(filePath, options) {
  const { pages } = options
  const bytes = await fsp.readFile(filePath)
  const srcDoc = await loadPdfDocument(bytes, filePath)
  const totalPages = srcDoc.getPageCount()

  const indices = parsePageSelection(pages, totalPages)

  const newDoc = await PDFDocument.create()
  const copiedPages = await newDoc.copyPages(srcDoc, indices)
  copiedPages.forEach((page) => newDoc.addPage(page))

  const outBytes = await newDoc.save()
  return [{ name: `${baseName(filePath)}_extracted.pdf`, buffer: Buffer.from(outBytes) }]
}

// ─────────────────────────────────────────────────────────────────────────
// Watermark / Page numbers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Draws a diagonal, semi-transparent text watermark centered on every
 * page, sized relative to that page's own dimensions so it scales
 * sensibly across documents with differently-sized pages.
 *
 * @param {string} filePath
 * @param {{ text: string, opacity: number, angle: number }} options
 */
async function addWatermark(filePath, options) {
  const { text, opacity, angle } = options
  const bytes = await fsp.readFile(filePath)
  const doc = await loadPdfDocument(bytes, filePath)

  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const alpha = Math.max(0, Math.min(1, opacity / 100))

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const fontSize = Math.max(12, Math.min(width, height) / 8)
    const textWidth = font.widthOfTextAtSize(text, fontSize)

    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: alpha,
      rotate: degrees(angle),
    })
  }

  const outBytes = await doc.save()
  return [{ name: `${baseName(filePath)}_watermarked.pdf`, buffer: Buffer.from(outBytes) }]
}

/**
 * Draws a page number (optionally prefixed) onto every page at the
 * requested corner/edge.
 *
 * @param {string} filePath
 * @param {{ position: string, start: number, prefix?: string }} options
 */
async function addPageNumbers(filePath, options) {
  const { position, start, prefix } = options
  const bytes = await fsp.readFile(filePath)
  const doc = await loadPdfDocument(bytes, filePath)

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  const margin = 28
  const fontSize = 10

  pages.forEach((page, i) => {
    const { width, height } = page.getSize()
    const label = `${prefix || ''}${start + i}`
    const textWidth = font.widthOfTextAtSize(label, fontSize)

    let x
    if (position === 'bottom-right') x = width - margin - textWidth
    else if (position === 'bottom-left') x = margin
    else x = width / 2 - textWidth / 2 // bottom-center / top-center

    const y = position === 'top-center' ? height - margin : margin / 1.5

    page.drawText(label, { x, y, size: fontSize, font, color: rgb(0, 0, 0) })
  })

  const outBytes = await doc.save()
  return [{ name: `${baseName(filePath)}_numbered.pdf`, buffer: Buffer.from(outBytes) }]
}

// ─────────────────────────────────────────────────────────────────────────
// Compress
// ─────────────────────────────────────────────────────────────────────────

const COMPRESSION_PRESETS = {
  low: { jpegQuality: 35, scaleFactor: 0.65 },
  medium: { jpegQuality: 60, scaleFactor: 0.85 },
  high: { jpegQuality: 80, scaleFactor: 1 },
}

/**
 * Walks every indirect object in the document looking for image XObjects,
 * and recompresses the ones it can confidently decode:
 *   - DCTDecode (already JPEG) streams are simply re-encoded at a lower
 *     quality/resolution.
 *   - Plain FlateDecode streams holding uncompressed 8-bit DeviceGray or
 *     DeviceRGB pixel data are inflated, treated as raw pixels, and
 *     re-encoded as JPEG.
 * Anything else (indexed color, soft masks/alpha, CMYK, JPEG2000, CCITT
 * fax, unusual bit depths) is left completely untouched — corrupting an
 * image we don't fully understand is worse than not shrinking it.
 */
async function compressEmbeddedImages(pdfDoc, jpegQuality, scaleFactor) {
  const entries = pdfDoc.context.enumerateIndirectObjects()

  for (const [ref, obj] of entries) {
    if (!(obj instanceof PDFRawStream)) continue

    const dict = obj.dict
    const subtype = dict.get(PDFName.of('Subtype'))
    if (!subtype || subtype.toString() !== '/Image') continue

    try {
      const filter = dict.get(PDFName.of('Filter'))
      if (filter instanceof PDFArray) continue // chained filters — too ambiguous to touch safely

      const filterName = filter ? filter.toString() : null
      const widthObj = dict.get(PDFName.of('Width'))
      const heightObj = dict.get(PDFName.of('Height'))
      const bpcObj = dict.get(PDFName.of('BitsPerComponent'))
      const colorSpace = dict.get(PDFName.of('ColorSpace'))

      // Any of these present means "too complex to safely touch" — skip.
      if (dict.get(PDFName.of('SMask'))) continue
      if (dict.get(PDFName.of('Mask'))) continue
      if (dict.get(PDFName.of('Decode'))) continue
      if (colorSpace && colorSpace.toString().includes('Indexed')) continue

      const width = widthObj && widthObj.asNumber ? widthObj.asNumber() : null
      const height = heightObj && heightObj.asNumber ? heightObj.asNumber() : null
      const bitsPerComponent = bpcObj && bpcObj.asNumber ? bpcObj.asNumber() : null

      if (!width || !height) continue

      let sharpInput

      if (filterName === '/DCTDecode') {
        sharpInput = sharp(Buffer.from(obj.contents))
      } else if (filterName === '/FlateDecode' && bitsPerComponent === 8) {
        const colorSpaceName = colorSpace ? colorSpace.toString() : '/DeviceRGB'
        let channels
        if (colorSpaceName.includes('DeviceGray')) channels = 1
        else if (colorSpaceName.includes('DeviceRGB')) channels = 3
        else continue // CMYK or an indirect/ICC colorspace — too ambiguous to assume

        const raw = zlib.inflateSync(Buffer.from(obj.contents))
        if (raw.length !== width * height * channels) continue // sanity check failed — don't risk it

        sharpInput = sharp(raw, { raw: { width, height, channels } })
      } else {
        continue // JPX, CCITT fax, run-length, or anything else we don't special-case
      }

      let pipeline = sharpInput
      if (scaleFactor < 1) {
        pipeline = pipeline.resize({
          width: Math.max(1, Math.round(width * scaleFactor)),
          withoutEnlargement: true,
        })
      }

      const recompressed = await pipeline.jpeg({ quality: jpegQuality, mozjpeg: true }).toBuffer()

      // Only keep the new version if it's actually smaller than the
      // original stream bytes.
      if (recompressed.length >= obj.contents.length) continue

      const newMeta = await sharp(recompressed).metadata()

      dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
      dict.set(PDFName.of('Width'), PDFNumber.of(newMeta.width))
      dict.set(PDFName.of('Height'), PDFNumber.of(newMeta.height))
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'))
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8))
      dict.delete(PDFName.of('DecodeParms'))

      pdfDoc.context.assign(ref, PDFRawStream.of(dict, recompressed))
    } catch (err) {
      // Best-effort: one problematic image is logged and skipped, never
      // allowed to abort the whole compression job.
      logger.warn('Skipped recompressing one embedded PDF image', { error: err.message })
    }
  }
}

/**
 * Re-saves a PDF with its embedded raster images recompressed at a
 * quality/resolution tier, plus standard structural compaction. Falls
 * back to returning the original bytes if recompression didn't actually
 * shrink the file (e.g. a text-only PDF with no images).
 *
 * @param {string} filePath
 * @param {{ quality: 'low'|'medium'|'high' }} options
 */
async function compressPdf(filePath, options) {
  const preset = COMPRESSION_PRESETS[options.quality] || COMPRESSION_PRESETS.medium

  const originalBytes = await fsp.readFile(filePath)
  const doc = await loadPdfDocument(originalBytes, filePath)

  await compressEmbeddedImages(doc, preset.jpegQuality, preset.scaleFactor)

  const outBytes = await doc.save({ useObjectStreams: true })
  const finalBytes = outBytes.length < originalBytes.length ? outBytes : originalBytes

  return [{ name: `${baseName(filePath)}_compressed.pdf`, buffer: Buffer.from(finalBytes) }]
}

// ─────────────────────────────────────────────────────────────────────────
// Protect / Unlock — see utils/pdfCrypto.js for the underlying algorithms
// ─────────────────────────────────────────────────────────────────────────

/** Extracts raw bytes from a pdf-lib PDFString/PDFHexString, across the accessor names different pdf-lib versions have used. */
function getRawBytes(stringObj) {
  if (!stringObj) return Buffer.alloc(0)
  if (typeof stringObj.asBytes === 'function') return Buffer.from(stringObj.asBytes())
  if (typeof stringObj.value === 'string') return Buffer.from(stringObj.value, 'latin1')
  return Buffer.alloc(0)
}

/** Wraps an arbitrary byte buffer as a PDFHexString — hex is unambiguous for binary content regardless of the original string's encoding. */
function bytesToHexString(buffer) {
  return PDFHexString.of(buffer.toString('hex'))
}

/**
 * Recursively encrypts (or decrypts — RC4 is symmetric, so the exact same
 * transform does both) every string and stream value reachable from
 * `value`, using `objectKey` (the per-indirect-object key derived via
 * pdfCrypto.computeObjectKey). Returns the possibly-new value to store
 * back in the parent container.
 */
function cryptValueInPlace(value, objectKey) {
  if (value instanceof PDFRawStream) {
    const dict = value.dict
    const type = dict.get(PDFName.of('Type'))
    if (type && type.toString() === '/XRef') return value // xref streams are never encrypted

    cryptDictEntriesInPlace(dict, objectKey)
    const transformed = pdfCrypto.rc4(objectKey, Buffer.from(value.contents))
    return PDFRawStream.of(dict, transformed)
  }

  if (value instanceof PDFDict) {
    cryptDictEntriesInPlace(value, objectKey)
    return value
  }

  if (value instanceof PDFArray) {
    cryptArrayEntriesInPlace(value, objectKey)
    return value
  }

  if (value && typeof value.asBytes === 'function') {
    // PDFString / PDFHexString — both expose binary content the same way.
    const rawBytes = getRawBytes(value)
    const transformed = pdfCrypto.rc4(objectKey, rawBytes)
    return bytesToHexString(transformed)
  }

  return value // numbers, names, booleans, refs, null — left untouched
}

function cryptDictEntriesInPlace(dict, objectKey) {
  for (const key of dict.keys()) {
    const value = dict.get(key)
    const newValue = cryptValueInPlace(value, objectKey)
    if (newValue !== value) dict.set(key, newValue)
  }
}

function cryptArrayEntriesInPlace(array, objectKey) {
  const size = array.size()
  for (let i = 0; i < size; i++) {
    const value = array.get(i)
    const newValue = cryptValueInPlace(value, objectKey)
    if (newValue !== value) array.array[i] = newValue
  }
}

/**
 * Walks every indirect object in the document and encrypts/decrypts its
 * contents in place using a key derived from that object's own number and
 * generation. `skipRef`, when given, identifies the Encrypt dictionary's
 * own indirect object — which must never be touched, per spec.
 */
function walkAndCryptDocument(context, fileEncryptionKey, skipRef) {
  const entries = context.enumerateIndirectObjects()

  for (const [ref, obj] of entries) {
    if (
      skipRef &&
      ref.objectNumber === skipRef.objectNumber &&
      ref.generationNumber === skipRef.generationNumber
    ) {
      continue
    }

    const objectKey = pdfCrypto.computeObjectKey(
      fileEncryptionKey,
      ref.objectNumber,
      ref.generationNumber
    )
    const newObj = cryptValueInPlace(obj, objectKey)
    if (newObj !== obj) context.assign(ref, newObj)
  }
}

/**
 * Password-protects a PDF using the PDF Standard Security Handler
 * (128-bit RC4, Revision 3). The same password is used as both the user
 * and owner password, matching the single-password field this tool's UI
 * exposes — anyone who can open the file can also remove the protection
 * (there is no separate "view-only, no editing" restriction tier here).
 *
 * @param {string} filePath
 * @param {{ password: string }} options
 */
async function protectPdf(filePath, options) {
  const { password } = options
  const bytes = await fsp.readFile(filePath)
  const doc = await loadPdfDocument(bytes, filePath)
  const context = doc.context

  const idBytes = crypto.randomBytes(16)
  const paddedPassword = pdfCrypto.padPassword(password)
  const ownerValue = pdfCrypto.computeOwnerValue(paddedPassword, paddedPassword)
  const permissions = pdfCrypto.FULL_PERMISSIONS
  const fileEncryptionKey = pdfCrypto.computeEncryptionKey(
    paddedPassword,
    ownerValue,
    permissions,
    idBytes
  )
  const userValue = pdfCrypto.computeUserValue(fileEncryptionKey, idBytes)

  try {
    walkAndCryptDocument(context, fileEncryptionKey, null)
  } catch (err) {
    logger.error('PDF encryption pass failed', { error: err.message, stack: err.stack })
    throw AppError.internal(`Failed to encrypt this PDF's contents: ${err.message}`)
  }

  const encryptDict = PDFDict.withContext(context)
  encryptDict.set(PDFName.of('Filter'), PDFName.of('Standard'))
  encryptDict.set(PDFName.of('V'), PDFNumber.of(pdfCrypto.SECURITY_HANDLER_V))
  encryptDict.set(PDFName.of('R'), PDFNumber.of(pdfCrypto.SECURITY_REVISION))
  encryptDict.set(PDFName.of('O'), bytesToHexString(ownerValue))
  encryptDict.set(PDFName.of('U'), bytesToHexString(userValue))
  encryptDict.set(PDFName.of('P'), PDFNumber.of(permissions))
  encryptDict.set(PDFName.of('Length'), PDFNumber.of(pdfCrypto.KEY_LENGTH_BYTES * 8))

  const encryptRef = context.register(encryptDict)
  context.trailerInfo.Encrypt = encryptRef
  context.trailerInfo.ID = context.obj([bytesToHexString(idBytes), bytesToHexString(idBytes)])

  // Object streams would bundle multiple logical objects into one
  // container stream at save time — since our encryption pass already ran
  // against the FULLY EXPANDED object graph (one key per logical object),
  // disabling object streams here keeps the saved file's structure
  // matching exactly what we just encrypted, object-for-object.
  const outBytes = await doc.save({ useObjectStreams: false })

  return [{ name: `${baseName(filePath)}_protected.pdf`, buffer: Buffer.from(outBytes) }]
}

/**
 * Removes password protection from a PDF that was encrypted with the
 * Standard Security Handler, 128-bit RC4 (V2/R3) — the same scheme
 * protectPdf produces, and one of the most common variants produced by
 * other PDF tools historically. Other schemes (AES, 40-bit RC4, the
 * newer SHA-256-based Revision 5/6 handler) are detected and rejected
 * with a clear, honest error rather than silently failing.
 *
 * @param {string} filePath
 * @param {{ password: string }} options
 */
async function unlockPdf(filePath, options) {
  const { password } = options
  const bytes = await fsp.readFile(filePath)

  let doc
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch (err) {
    throw AppError.unprocessable(`Could not read this PDF: ${err.message}`)
  }

  const context = doc.context
  const encryptEntry = context.trailerInfo.Encrypt

  if (!encryptEntry) {
    throw AppError.badRequest('This PDF does not appear to be password-protected.')
  }

  const encryptRef = encryptEntry instanceof PDFRef ? encryptEntry : null
  const encryptDict = context.lookup(encryptEntry)

  if (!(encryptDict instanceof PDFDict)) {
    throw AppError.unprocessable("Could not read this PDF's encryption dictionary.")
  }

  const filterName = encryptDict.get(PDFName.of('Filter'))
  const vEntry = encryptDict.get(PDFName.of('V'))
  const rEntry = encryptDict.get(PDFName.of('R'))
  const v = vEntry && vEntry.asNumber ? vEntry.asNumber() : null
  const r = rEntry && rEntry.asNumber ? rEntry.asNumber() : null

  const isSupportedScheme =
    filterName && filterName.toString() === '/Standard' && v === pdfCrypto.SECURITY_HANDLER_V && r === pdfCrypto.SECURITY_REVISION

  if (!isSupportedScheme) {
    throw AppError.unprocessable(
      'This PDF uses an encryption method that is not supported here (only 128-bit RC4 ' +
        '"Standard Security", V2/R3, can be unlocked). It may use AES encryption or an older ' +
        '40-bit scheme.'
    )
  }

  const ownerValue = getRawBytes(encryptDict.get(PDFName.of('O')))
  const userValue = getRawBytes(encryptDict.get(PDFName.of('U')))
  const permissionsEntry = encryptDict.get(PDFName.of('P'))
  const permissions = permissionsEntry && permissionsEntry.asNumber ? permissionsEntry.asNumber() : null

  if (ownerValue.length !== 32 || userValue.length !== 32 || permissions === null) {
    throw AppError.unprocessable("This PDF's encryption dictionary is malformed or incomplete.")
  }

  const idArray = context.lookup(context.trailerInfo.ID)
  const idBytes =
    idArray instanceof PDFArray && idArray.size() > 0 ? getRawBytes(idArray.get(0)) : Buffer.alloc(0)

  const authResult = pdfCrypto.authenticate(password, {
    O: ownerValue,
    U: userValue,
    P: permissions,
    idBytes,
  })

  if (!authResult.isValid) {
    throw AppError.badRequest('Incorrect password.')
  }

  try {
    walkAndCryptDocument(context, authResult.encryptionKey, encryptRef)
  } catch (err) {
    logger.error('PDF decryption pass failed', { error: err.message, stack: err.stack })
    throw AppError.internal(`Failed to decrypt this PDF's contents: ${err.message}`)
  }

  context.trailerInfo.Encrypt = undefined

  const outBytes = await doc.save({ useObjectStreams: false })
  return [{ name: `${baseName(filePath)}_unlocked.pdf`, buffer: Buffer.from(outBytes) }]
}

module.exports = {
  mergePdfs,
  splitPdf,
  rotatePdf,
  deletePages,
  extractPages,
  addWatermark,
  addPageNumbers,
  compressPdf,
  protectPdf,
  unlockPdf,
}
