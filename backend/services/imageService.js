/**
 * backend/services/imageService.js
 * ─────────────────────────────────────────────────────────────────────────
 * Real image-processing implementations backing every "Image Tool" in the
 * frontend catalog, built on `sharp` (libvips bindings — fast, low-memory,
 * battle-tested in production at huge scale).
 *
 * Every exported function follows the same contract used throughout this
 * backend: it returns `Promise<Array<{ name: string, buffer: Buffer }>>`,
 * even when there is conceptually only one output. The controller decides
 * whether to save that single output as-is or zip multiple outputs
 * together — this module never needs to know or care which happens.
 *
 * Batch operations (compress / convert, both of which accept multiple
 * uploaded files per the frontend's `multi: true` config) process files
 * SEQUENTIALLY rather than with `Promise.all`. This is a deliberate choice:
 * sharp/libvips processing is CPU- and memory-intensive per image, and
 * this backend must support multiple simultaneous users — firing off many
 * concurrent sharp pipelines for one user's batch would let a single
 * request starve everyone else's. Sequential processing keeps memory and
 * CPU usage predictable under concurrent load.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

const path = require('path')
const sharp = require('sharp')
const { PDFDocument } = require('pdf-lib')

const { AppError } = require('../utils/errors')

// Pixel-to-point conversion used when sizing a PDF page to match an
// embedded image: PDF points are defined at 72 per inch, and we treat
// uploaded images as if captured/exported at 96 DPI (the common screen/
// web-image baseline). This keeps "Image to PDF" output pages close to
// the image's natural on-screen size rather than measuring 1 px == 1 pt
// (which would produce comically oversized pages for any high-res photo).
const PIXELS_TO_POINTS = 72 / 96

/** Returns a file's name without its extension, e.g. "/tmp/photo.jpg" → "photo" */
function baseName(filePath) {
  return path.basename(filePath, path.extname(filePath))
}

/**
 * Resize an image to the given width/height using sharp's `fit` modes.
 * At least one of width/height is guaranteed present by the options
 * validator; sharp computes the missing dimension proportionally when
 * only one is given.
 *
 * @param {string} filePath
 * @param {{ width?: number, height?: number, fit?: 'cover'|'contain'|'fill'|'inside' }} options
 */
async function resizeImage(filePath, options) {
  const { width, height, fit = 'cover' } = options

  let buffer
  try {
    buffer = await sharp(filePath)
      .resize({
        width: width || undefined,
        height: height || undefined,
        fit,
        withoutEnlargement: false,
      })
      .toBuffer()
  } catch (err) {
    throw AppError.unprocessable(`Could not resize this image: ${err.message}`)
  }

  const ext = path.extname(filePath) || '.jpg'
  return [{ name: `${baseName(filePath)}_resized${ext}`, buffer }]
}

/**
 * Crop a rectangular region out of an image. Validates the requested
 * region actually fits inside the source image before attempting the
 * crop, since sharp's `extract()` throws a fairly opaque error otherwise.
 *
 * @param {string} filePath
 * @param {{ width: number, height: number, left?: number, top?: number }} options
 */
async function cropImage(filePath, options) {
  const { width, height } = options
  const left = options.left || 0
  const top = options.top || 0

  const metadata = await sharp(filePath).metadata()
  if (!metadata.width || !metadata.height) {
    throw AppError.unprocessable('Could not read this image\'s dimensions.')
  }

  if (left + width > metadata.width || top + height > metadata.height) {
    throw AppError.badRequest(
      `Crop region (${width}×${height} at offset ${left},${top}) exceeds the ` +
        `image's actual size (${metadata.width}×${metadata.height}).`
    )
  }

  let buffer
  try {
    buffer = await sharp(filePath).extract({ left, top, width, height }).toBuffer()
  } catch (err) {
    throw AppError.unprocessable(`Could not crop this image: ${err.message}`)
  }

  const ext = path.extname(filePath) || '.jpg'
  return [{ name: `${baseName(filePath)}_cropped${ext}`, buffer }]
}

/**
 * Rotate an image by a fixed angle (90 / -90 / 180 degrees, enforced by
 * the options validator). Since these are all multiples of 90°, the
 * rotated canvas never gains new corners that would need a fill color.
 *
 * @param {string} filePath
 * @param {{ angle: number }} options
 */
async function rotateImage(filePath, options) {
  const { angle } = options

  let buffer
  try {
    buffer = await sharp(filePath).rotate(angle).toBuffer()
  } catch (err) {
    throw AppError.unprocessable(`Could not rotate this image: ${err.message}`)
  }

  const ext = path.extname(filePath) || '.jpg'
  return [{ name: `${baseName(filePath)}_rotated${ext}`, buffer }]
}

/**
 * Flip an image horizontally (mirror left↔right) or vertically (mirror
 * top↔bottom).
 *
 * sharp's naming is easy to mix up: `.flip()` mirrors about the
 * HORIZONTAL axis (top↔bottom = our "vertical" direction), and `.flop()`
 * mirrors about the VERTICAL axis (left↔right = our "horizontal"
 * direction). The mapping below is intentional, not a typo.
 *
 * @param {string} filePath
 * @param {{ direction: 'horizontal' | 'vertical' }} options
 */
async function flipImage(filePath, options) {
  const { direction } = options

  let buffer
  try {
    const pipeline = direction === 'vertical' ? sharp(filePath).flip() : sharp(filePath).flop()
    buffer = await pipeline.toBuffer()
  } catch (err) {
    throw AppError.unprocessable(`Could not flip this image: ${err.message}`)
  }

  const ext = path.extname(filePath) || '.jpg'
  return [{ name: `${baseName(filePath)}_flipped${ext}`, buffer }]
}

/**
 * Re-encodes one or more images at a reduced quality to shrink file size,
 * using the codec-appropriate sharp encoder for each file's own format
 * (JPEG stays JPEG, PNG stays PNG with a high compression level, WebP
 * stays WebP). Anything else (GIF/BMP) is re-encoded as JPEG, which is
 * almost always smaller than the source and is what "compress" implies.
 *
 * @param {string[]} filePaths
 * @param {{ quality: number }} options - 1-100
 * @returns {Promise<Array<{ name: string, buffer: Buffer }>>} one entry per input file
 */
async function compressImageBatch(filePaths, options) {
  const { quality } = options
  const results = []

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase()
    let pipeline = sharp(filePath)
    let outExt = ext

    try {
      if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true })
        outExt = ext
      } else if (ext === '.png') {
        // PNG quality maps to libvips' palette-based quantization quality —
        // still lossless pixel data, but a smaller, more efficient palette.
        pipeline = pipeline.png({ quality, compressionLevel: 9, palette: true })
        outExt = '.png'
      } else if (ext === '.webp') {
        pipeline = pipeline.webp({ quality })
        outExt = '.webp'
      } else {
        // Fallback for any other accepted raster format.
        pipeline = pipeline.jpeg({ quality, mozjpeg: true })
        outExt = '.jpg'
      }

      const buffer = await pipeline.toBuffer()
      results.push({ name: `${baseName(filePath)}_compressed${outExt}`, buffer })
    } catch (err) {
      throw AppError.unprocessable(
        `Could not compress "${path.basename(filePath)}": ${err.message}`
      )
    }
  }

  return results
}

/**
 * Converts one or more images to a target raster format.
 *
 * @param {string[]} filePaths
 * @param {'jpeg'|'png'|'webp'} format
 * @returns {Promise<Array<{ name: string, buffer: Buffer }>>} one entry per input file
 */
async function convertImageBatch(filePaths, format) {
  const EXTENSION_BY_FORMAT = { jpeg: '.jpg', png: '.png', webp: '.webp' }
  const outExt = EXTENSION_BY_FORMAT[format]

  if (!outExt) {
    throw AppError.internal(`Unsupported image conversion target "${format}".`)
  }

  const results = []

  for (const filePath of filePaths) {
    try {
      let pipeline = sharp(filePath)

      if (format === 'jpeg') {
        // JPEG has no alpha channel — flatten any transparency onto a
        // white background first so converted PNGs/WebPs/GIFs don't turn
        // black where they used to be transparent.
        pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 92, mozjpeg: true })
      } else if (format === 'png') {
        pipeline = pipeline.png({ compressionLevel: 9 })
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality: 92 })
      }

      const buffer = await pipeline.toBuffer()
      results.push({ name: `${baseName(filePath)}${outExt}`, buffer })
    } catch (err) {
      throw AppError.unprocessable(
        `Could not convert "${path.basename(filePath)}" to ${format.toUpperCase()}: ${err.message}`
      )
    }
  }

  return results
}

/**
 * Combines one or more raster images into a single PDF — one page per
 * image, each page sized to match that image's dimensions (converted
 * from pixels to PDF points at an assumed 96 DPI). Used for JPG/PNG/WebP
 * → PDF.
 *
 * Every image is funneled through sharp first, which both normalizes EXIF
 * orientation (`.rotate()` with no arguments auto-rotates based on the
 * image's embedded orientation tag) and guarantees the bytes handed to
 * pdf-lib are in a format pdf-lib actually knows how to embed — pdf-lib
 * only supports embedding JPEG and PNG, not WebP/GIF/BMP, so any non-JPEG
 * source is re-encoded as PNG (lossless) before embedding.
 *
 * @param {string[]} filePaths
 * @returns {Promise<Array<{ name: string, buffer: Buffer }>>} always a single-entry array
 */
async function imagesToPdf(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    throw AppError.badRequest('At least one image is required.')
  }

  const pdfDoc = await PDFDocument.create()

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase()
    const isJpeg = ext === '.jpg' || ext === '.jpeg'

    let embeddedImage
    try {
      if (isJpeg) {
        const jpegBytes = await sharp(filePath).rotate().jpeg({ quality: 92 }).toBuffer()
        embeddedImage = await pdfDoc.embedJpg(jpegBytes)
      } else {
        const pngBytes = await sharp(filePath).rotate().png({ compressionLevel: 9 }).toBuffer()
        embeddedImage = await pdfDoc.embedPng(pngBytes)
      }
    } catch (err) {
      throw AppError.unprocessable(
        `Could not embed "${path.basename(filePath)}" into the PDF: ${err.message}`
      )
    }

    const { width, height } = embeddedImage.scale(1)
    const pageWidth = width * PIXELS_TO_POINTS
    const pageHeight = height * PIXELS_TO_POINTS

    const page = pdfDoc.addPage([pageWidth, pageHeight])
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    })
  }

  const pdfBytes = await pdfDoc.save()

  const name =
    filePaths.length === 1
      ? `${baseName(filePaths[0])}.pdf`
      : `images-to-pdf-${Date.now()}.pdf`

  return [{ name, buffer: Buffer.from(pdfBytes) }]
}

module.exports = {
  resizeImage,
  cropImage,
  rotateImage,
  flipImage,
  compressImageBatch,
  convertImageBatch,
  imagesToPdf,
}
