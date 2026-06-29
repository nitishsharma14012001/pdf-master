/**
 * backend/utils/validators.js
 * ─────────────────────────────────────────────────────────────────────────
 * Validates and coerces the `options` object sent alongside each upload.
 *
 * Context: the frontend serializes all option values through
 * `JSON.stringify(options)` where `options` was built from plain HTML
 * `<input>`/`<select>` elements — so EVERY value arrives as a string, even
 * for things that are conceptually numbers ("50") or booleans. This module
 * is responsible for:
 *
 *   - Coercing those strings into the actual types each service expects
 *     (numbers, enums, etc).
 *   - Applying the same default values the frontend's UI shows, so a
 *     request with no/partial options behaves identically to one where
 *     the user accepted every default.
 *   - Rejecting anything out of range, malformed (e.g. a page-range string
 *     that doesn't look like "1,3,5-8"), or missing where required —
 *     with a precise, user-facing error message.
 *
 * Every tool in TOOL_OPTION_SCHEMAS mirrors the `TOOL_OPTIONS` config in
 * frontend/src/components/pages/ToolPage.jsx field-for-field, so the two
 * stay in lockstep.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

const { z } = require('zod')
const { AppError } = require('./errors')

// HTML inputs left empty submit `''`, not `undefined` — normalize that to
// `undefined` before it reaches zod so `.optional()` / `.default()` behave
// the way you'd expect for an unfilled field.
const emptyToUndefined = (val) => (val === '' || val === null || val === undefined ? undefined : val)

// Matches comma-separated page numbers and ranges, e.g. "1,3,5-8" or
// "1, 3, 5-8". Used for delete/extract/rotate/split page selections.
const PAGE_RANGE_PATTERN = /^\d+(-\d+)?(\s*,\s*\d+(-\d+)?)*$/

/**
 * Builds a zod schema for a "page range" style string field.
 * @param {{ required?: boolean }} opts
 */
function pageRangeField({ required = false } = {}) {
  const base = z
    .string()
    .trim()
    .regex(PAGE_RANGE_PATTERN, 'Use a format like "1,3,5-8".')

  if (required) {
    return z.preprocess(emptyToUndefined, base.min(1, 'A page range is required.'))
  }
  return z.preprocess(emptyToUndefined, base.optional())
}

/**
 * Builds a zod schema for a numeric field that arrives as a string.
 * @param {{ min?: number, max?: number, integer?: boolean, required?: boolean, defaultValue?: number }} opts
 */
function numberField({ min, max, integer = true, required = false, defaultValue } = {}) {
  let base = integer ? z.coerce.number().int('Must be a whole number.') : z.coerce.number()
  if (typeof min === 'number') base = base.min(min, `Must be at least ${min}.`)
  if (typeof max === 'number') base = base.max(max, `Must be at most ${max}.`)

  let schema = base
  if (defaultValue !== undefined) {
    schema = base.default(defaultValue)
  } else if (!required) {
    schema = base.optional()
  }

  return z.preprocess(emptyToUndefined, schema)
}

/**
 * Builds a zod schema for a fixed set of numeric choices delivered as
 * strings by a <select> (e.g. rotation angles "90" | "-90" | "180").
 */
function numericChoiceField(choices, defaultValue) {
  const schema = z.coerce
    .number()
    .refine((v) => choices.includes(v), `Must be one of: ${choices.join(', ')}.`)
  return z.preprocess(emptyToUndefined, defaultValue !== undefined ? schema.default(defaultValue) : schema)
}

// Schema used for every tool that takes no meaningful options at all
// (merge-pdf, the *-to-pdf image converters, the convert-* image tools).
// `.strip()` quietly discards any unexpected keys instead of erroring,
// since the frontend always sends `options: {}` for these.
const NO_OPTIONS_SCHEMA = z.object({}).strip()

const TOOL_OPTION_SCHEMAS = {
  // ── PDF tools ────────────────────────────────────────────────────────────
  'compress-pdf': z.object({
    quality: z.preprocess(emptyToUndefined, z.enum(['low', 'medium', 'high']).default('medium')),
  }),

  'rotate-pdf': z.object({
    angle: numericChoiceField([90, -90, 180], 90),
    pages: pageRangeField(),
  }),

  'protect-pdf': z.object({
    password: z.string().trim().min(1, 'A password is required.').max(128, 'Password is too long.'),
  }),

  'unlock-pdf': z.object({
    password: z.string().trim().min(1, 'The current PDF password is required.').max(128, 'Password is too long.'),
  }),

  'add-watermark': z.object({
    text: z.string().trim().min(1, 'Watermark text is required.').max(200, 'Watermark text is too long.'),
    opacity: numberField({ min: 1, max: 100, defaultValue: 50 }),
    angle: numberField({ min: -180, max: 180, integer: false, defaultValue: 45 }),
  }),

  'add-page-numbers': z.object({
    position: z.preprocess(
      emptyToUndefined,
      z.enum(['bottom-center', 'bottom-right', 'bottom-left', 'top-center']).default('bottom-center')
    ),
    start: numberField({ min: 1, max: 100000, defaultValue: 1 }),
    prefix: z.preprocess(emptyToUndefined, z.string().trim().max(50, 'Prefix is too long.').optional()),
  }),

  'split-pdf': z
    .object({
      mode: z.preprocess(emptyToUndefined, z.enum(['all', 'range', 'every']).default('all')),
      range: pageRangeField(),
      every: numberField({ min: 1, max: 1000, defaultValue: 1 }),
    })
    .refine((data) => data.mode !== 'range' || Boolean(data.range && data.range.length > 0), {
      message: 'A page range is required when split mode is "range".',
      path: ['range'],
    }),

  'extract-pages': z.object({
    pages: pageRangeField({ required: true }),
  }),

  'delete-pages': z.object({
    pages: pageRangeField({ required: true }),
  }),

  // ── Image tools ──────────────────────────────────────────────────────────
  'resize-image': z
    .object({
      width: numberField({ min: 1, max: 10000 }),
      height: numberField({ min: 1, max: 10000 }),
      fit: z.preprocess(emptyToUndefined, z.enum(['cover', 'contain', 'fill', 'inside']).default('cover')),
    })
    .refine((data) => data.width !== undefined || data.height !== undefined, {
      message: 'Provide at least a width or a height.',
      path: ['width'],
    }),

  'compress-image': z.object({
    quality: numberField({ min: 1, max: 100, defaultValue: 70 }),
  }),

  'crop-image': z.object({
    width: numberField({ min: 1, max: 10000, required: true }),
    height: numberField({ min: 1, max: 10000, required: true }),
    left: numberField({ min: 0, max: 100000, defaultValue: 0 }),
    top: numberField({ min: 0, max: 100000, defaultValue: 0 }),
  }),

  'rotate-image': z.object({
    angle: numericChoiceField([90, -90, 180], 90),
  }),

  'flip-image': z.object({
    direction: z.preprocess(emptyToUndefined, z.enum(['horizontal', 'vertical']).default('horizontal')),
  }),

  // ── No-option tools ──────────────────────────────────────────────────────
  'merge-pdf': NO_OPTIONS_SCHEMA,
  'jpg-to-pdf': NO_OPTIONS_SCHEMA,
  'png-to-pdf': NO_OPTIONS_SCHEMA,
  'webp-to-pdf': NO_OPTIONS_SCHEMA,
  'convert-jpg': NO_OPTIONS_SCHEMA,
  'convert-png': NO_OPTIONS_SCHEMA,
  'convert-webp': NO_OPTIONS_SCHEMA,
}

/**
 * Validates & coerces `rawOptions` for the given tool, returning a clean,
 * fully-typed options object with defaults applied.
 *
 * @param {string} toolId
 * @param {unknown} rawOptions
 * @returns {Object} validated options
 * @throws {AppError} 400 with a human-readable message (and a `details`
 *                     array of { field, message } for programmatic clients)
 */
function validateOptions(toolId, rawOptions) {
  const schema = TOOL_OPTION_SCHEMAS[toolId] || NO_OPTIONS_SCHEMA
  const input = rawOptions && typeof rawOptions === 'object' ? rawOptions : {}

  const result = schema.safeParse(input)

  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
      message: issue.message,
    }))

    const summary = fieldErrors.map((e) => `${e.field}: ${e.message}`).join('; ')

    throw AppError.badRequest(`Invalid options for "${toolId}" — ${summary}`, fieldErrors)
  }

  return result.data
}

module.exports = { validateOptions, TOOL_OPTION_SCHEMAS }
