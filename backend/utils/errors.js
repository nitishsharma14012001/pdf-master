/**
 * backend/utils/errors.js
 * ─────────────────────────────────────────────────────────────────────────
 * A single, shared "operational error" type used across controllers,
 * services, validators, and route handlers.
 *
 * Why this exists:
 *   Node/Express apps end up with two very different kinds of errors:
 *
 *     1. EXPECTED / OPERATIONAL errors — the request was bad, the file was
 *        the wrong type, a password was wrong, a page range was out of
 *        bounds, the tool doesn't exist, etc. These are anticipated,
 *        deserve a precise HTTP status code, and a message that is safe
 *        (and useful) to show the end user.
 *
 *     2. UNEXPECTED / PROGRAMMER errors — a bug, a library throwing
 *        something we didn't anticipate, a typo. These should be logged
 *        with a full stack trace and never leak internal details to the
 *        client in production.
 *
 *   `AppError` models bucket (1). Anywhere in the codebase that throws an
 *   `AppError` is explicitly telling the global error handler "this is a
 *   known, well-formed failure — use this exact status code and message."
 *   Anything else that bubbles up to the global handler is treated as an
 *   unexpected bug (see server.js's final error-handling middleware).
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict'

class AppError extends Error {
  /**
   * @param {string} message     - Safe to display directly to the end user.
   * @param {number} statusCode  - HTTP status code to send (default 400).
   * @param {Object} [details]   - Optional structured extra info (e.g. a
   *                                list of invalid fields from zod) that
   *                                route handlers may choose to include
   *                                in the JSON error response.
   */
  constructor(message, statusCode = 400, details = undefined) {
    super(message)

    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details

    // Marks this as an "operational" error — known/expected, as opposed to
    // a programmer error or an unhandled exception from a dependency.
    this.isOperational = true

    // Preserve a proper stack trace pointing at where the error was
    // constructed (not at this base class constructor).
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, AppError)
    }
  }

  /** 400 Bad Request — malformed input, invalid options, bad page ranges, etc. */
  static badRequest(message, details) {
    return new AppError(message, 400, details)
  }

  /** 401 Unauthorized — missing/invalid credentials. */
  static unauthorized(message = 'Authentication required.') {
    return new AppError(message, 401)
  }

  /** 403 Forbidden — authenticated, but not allowed to do this. */
  static forbidden(message = 'You do not have permission to do this.') {
    return new AppError(message, 403)
  }

  /** 404 Not Found — tool / job / file does not exist. */
  static notFound(message = 'Resource not found.') {
    return new AppError(message, 404)
  }

  /** 413 Payload Too Large — file exceeds the configured size limit. */
  static payloadTooLarge(message = 'File is too large.') {
    return new AppError(message, 413)
  }

  /** 422 Unprocessable Entity — well-formed request, but the file/content itself is invalid (corrupt PDF, wrong password, unsupported encoding). */
  static unprocessable(message, details) {
    return new AppError(message, 422, details)
  }

  /** 429 Too Many Requests — rate limit exceeded. */
  static tooManyRequests(message = 'Too many requests. Please slow down.') {
    return new AppError(message, 429)
  }

  /** 501 Not Implemented — the tool/feature is recognized but not available in this deployment. */
  static notImplemented(message = 'This feature is not available.') {
    return new AppError(message, 501)
  }

  /** 500 Internal Server Error — something unexpected happened while doing otherwise-valid work. */
  static internal(message = 'Internal server error.') {
    return new AppError(message, 500)
  }
}

module.exports = { AppError }
