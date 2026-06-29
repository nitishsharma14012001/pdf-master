/**
 * backend/utils/pageRanges.js
 * ─────────────────────────────────────────────────────────────────────────
 * Turns a human-typed page selection string — e.g. "1,3,5-8" — into a
 * validated, deduplicated, sorted array of zero-based page INDICES ready
 * to hand straight to pdf-lib (`PDFDocument.copyPages`, `getPages()[i]`,
 * etc, which are all zero-indexed).
 *
 * `utils/validators.js` already confirms the string is *shaped* correctly
 * (via PAGE_RANGE_PATTERN) before this module ever sees it. This module's
 * job is the semantic half: resolving "what does this mean for THIS
 * specific PDF" — which requires knowing the document's actual page
 * count, and is therefore done inside the PDF service right before/after
 * loading the document, not in the generic options validator.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

const { AppError } = require('./errors')

/**
 * Returns every page index for a document with `totalPages` pages:
 * [0, 1, 2, ..., totalPages - 1]
 */
function allPageIndices(totalPages) {
  return Array.from({ length: totalPages }, (_, i) => i)
}

/**
 * Throws if a 1-based page number is outside the document's bounds.
 */
function assertPageInRange(pageNumber, totalPages, originalSegment) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
    throw AppError.badRequest(
      `Page ${pageNumber} is out of range — this document has ${totalPages} page(s).` +
        (originalSegment ? ` (from "${originalSegment}")` : '')
    )
  }
}

/**
 * Parses a page-selection string like "1,3,5-8" into a sorted, deduplicated
 * array of ZERO-BASED page indices, validated against `totalPages`.
 *
 * An empty/blank string is treated as "every page" — this lets tools like
 * Rotate PDF use the same parser for both "apply to specific pages" and
 * "apply to the whole document" (when the optional `pages` field is left
 * blank).
 *
 * @param {string} rangeStr     - e.g. "1,3,5-8", or '' / undefined for "all"
 * @param {number} totalPages   - the actual page count of the loaded PDF
 * @returns {number[]} sorted, deduplicated zero-based page indices
 */
function parsePageSelection(rangeStr, totalPages) {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw AppError.unprocessable('This document has no pages to select from.')
  }

  if (!rangeStr || rangeStr.trim() === '') {
    return allPageIndices(totalPages)
  }

  const segments = rangeStr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const indices = new Set()

  for (const segment of segments) {
    const rangeMatch = segment.match(/^(\d+)-(\d+)$/)
    const singleMatch = segment.match(/^(\d+)$/)

    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10)
      let end = parseInt(rangeMatch[2], 10)
      if (start > end) [start, end] = [end, start] // tolerate "8-5" as "5-8"

      assertPageInRange(start, totalPages, segment)
      assertPageInRange(end, totalPages, segment)

      for (let page = start; page <= end; page++) {
        indices.add(page - 1)
      }
    } else if (singleMatch) {
      const page = parseInt(singleMatch[1], 10)
      assertPageInRange(page, totalPages, segment)
      indices.add(page - 1)
    } else {
      // Should be unreachable given upstream regex validation, but a PDF's
      // actual page count is only known here, so we keep this defensive.
      throw AppError.badRequest(
        `Invalid page range segment "${segment}". Use a format like "1,3,5-8".`
      )
    }
  }

  if (indices.size === 0) {
    throw AppError.badRequest('No valid pages were specified.')
  }

  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Returns every page index EXCEPT the ones in `indices` — used by
 * Delete Pages, which conceptually removes a selection but is implemented
 * by keeping its complement.
 *
 * @param {number[]} indices    - zero-based indices to exclude
 * @param {number} totalPages
 * @returns {number[]} the remaining zero-based indices, in order
 */
function complementIndices(indices, totalPages) {
  const excluded = new Set(indices)
  const remaining = []
  for (let i = 0; i < totalPages; i++) {
    if (!excluded.has(i)) remaining.push(i)
  }
  return remaining
}

/**
 * Splits a document's pages into consecutive chunks of `everyN` pages —
 * used by Split PDF's "every N pages" mode. Each chunk is itself an array
 * of zero-based page indices.
 *
 * Example: chunkPagesEvery(7, 3) → [[0,1,2], [3,4,5], [6]]
 *
 * @param {number} totalPages
 * @param {number} everyN
 * @returns {number[][]}
 */
function chunkPagesEvery(totalPages, everyN) {
  if (!Number.isInteger(everyN) || everyN < 1) {
    throw AppError.badRequest('"every" must be a whole number of at least 1.')
  }

  const chunks = []
  for (let start = 0; start < totalPages; start += everyN) {
    const end = Math.min(start + everyN, totalPages)
    chunks.push(Array.from({ length: end - start }, (_, i) => start + i))
  }
  return chunks
}

module.exports = {
  allPageIndices,
  parsePageSelection,
  complementIndices,
  chunkPagesEvery,
}
