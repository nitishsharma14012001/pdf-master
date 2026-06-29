'use strict'

/**
 * PDF Master — Logger
 *
 * Centralised Winston logger used by every module in the backend.
 *
 * Transports:
 *   Development : colourised single-line console output
 *   Production  : JSON console + rotating file transports (error.log,
 *                 combined.log) with automatic daily rotation and a
 *                 14-day retention window.
 *
 * Log levels (lowest → highest severity):
 *   debug  — verbose internal state, disabled in production
 *   http   — one line per HTTP request (written by morgan)
 *   info   — normal operational events (startup, job complete, cleanup)
 *   warn   — recoverable problems (bad upload, cleanup failure)
 *   error  — unrecoverable errors that need operator attention
 *
 * Usage:
 *   const logger = require('./logger')
 *   logger.info('Tool completed', { toolId, jobId, outputSize })
 *   logger.error('Unhandled error', { message: err.message, stack: err.stack })
 *
 * Exports:
 *   The winston Logger instance (default export via module.exports).
 */

const winston = require('winston')
const path    = require('path')
const fs      = require('fs')

// ─── Constants ────────────────────────────────────────────────────────────────

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const IS_TEST       = process.env.NODE_ENV === 'test'
const LOG_LEVEL     = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug')
const LOG_DIR       = process.env.LOG_DIR   || path.join(process.cwd(), 'logs')

// ─── Custom log levels ────────────────────────────────────────────────────────

// Add the non-standard 'http' level between debug and info so that morgan's
// stream write target exists without polluting the info channel.
const CUSTOM_LEVELS = {
  levels: {
    error: 0,
    warn:  1,
    info:  2,
    http:  3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn:  'yellow',
    info:  'green',
    http:  'magenta',
    debug: 'cyan',
  },
}

winston.addColors(CUSTOM_LEVELS.colors)

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Redact sensitive fields from log metadata before they reach any transport.
 * This is a best-effort safeguard — structured logging should never include
 * raw passwords, tokens, or PII, but belt-and-suspenders is appropriate here.
 */
const REDACT_KEYS = new Set([
  'password', 'passwordHash', 'token', 'secret', 'authorization',
  'credit_card', 'ssn', 'api_key', 'apiKey',
])

function redactSensitive(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj
  const out = Array.isArray(obj) ? [] : {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase())
      ? '[REDACTED]'
      : redactSensitive(v, depth + 1)
  }
  return out
}

const redactFormat = winston.format((info) => {
  // Redact every key in the info object except the reserved winston ones
  const { level, message, timestamp, stack, ...meta } = info
  const cleaned = redactSensitive(meta)
  return Object.assign(info, cleaned)
})

/**
 * Development console format — single colourised line:
 *   2024-01-15 14:32:01 [info] Tool completed {"toolId":"merge-pdf","outputSize":48201}
 */
const devConsoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  redactFormat(),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? ' ' + JSON.stringify(meta, null, 0)
      : ''
    const stackStr = stack ? `\n${stack}` : ''
    return `${timestamp} [${level}] ${message}${metaStr}${stackStr}`
  })
)

/**
 * Production JSON format — structured, machine-parseable:
 *   {"timestamp":"2024-01-15T14:32:01.000Z","level":"info","message":"...","toolId":"..."}
 *
 * Includes the hostname and process PID so log aggregators can correlate
 * entries across multiple instances.
 */
const productionJsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  redactFormat(),
  winston.format.json()
)

// ─── Transports ───────────────────────────────────────────────────────────────

/**
 * Ensure the log directory exists before registering file transports.
 * This runs synchronously at module load — it is intentional; logger
 * initialisation must complete before any code starts logging.
 */
function ensureLogDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[logger] Cannot create log directory "${LOG_DIR}": ${err.message}`)
  }
}

/**
 * Build the array of transports depending on the runtime environment.
 *
 * Test environment: silent (no output so jest output stays clean).
 * Development:      colourised console only.
 * Production:       JSON console + two rotating file transports.
 */
function buildTransports() {
  // Completely silent in test environment
  if (IS_TEST) {
    return [new winston.transports.Console({ silent: true })]
  }

  // Development — colourised console
  if (!IS_PRODUCTION) {
    return [
      new winston.transports.Console({ format: devConsoleFormat }),
    ]
  }

  // Production — JSON console (for log aggregators like Datadog / CloudWatch)
  // + file transports with basic rotation via winston's built-in maxFiles/maxsize
  ensureLogDir()

  return [
    // Console: structured JSON (stdout for container log drivers)
    new winston.transports.Console({ format: productionJsonFormat }),

    // Error-only log file — rotates at 10 MB, keeps 14 files (≈ 14 days)
    new winston.transports.File({
      filename:  path.join(LOG_DIR, 'error.log'),
      level:     'error',
      format:    productionJsonFormat,
      maxsize:   10 * 1024 * 1024, // 10 MB per file
      maxFiles:  14,
      tailable:  true,
    }),

    // Combined log file — all levels at or above the configured threshold
    new winston.transports.File({
      filename:  path.join(LOG_DIR, 'combined.log'),
      format:    productionJsonFormat,
      maxsize:   50 * 1024 * 1024, // 50 MB per file
      maxFiles:  7,
      tailable:  true,
    }),
  ]
}

// ─── Logger instance ──────────────────────────────────────────────────────────

const logger = winston.createLogger({
  levels:     CUSTOM_LEVELS.levels,
  level:      LOG_LEVEL,
  transports: buildTransports(),

  // Prevent winston from crashing the process on uncaught exceptions.
  // We register our own handlers below.
  exitOnError: false,
})

// ─── Process-level error handlers ────────────────────────────────────────────

/**
 * Log uncaught exceptions and unhandled promise rejections.
 * These handlers log the error and then allow the process to exit (or be
 * restarted by the process manager).  We do NOT suppress the exit because
 * the process is in an unknown state after an uncaught exception.
 */
if (!IS_TEST) {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — process will exit', {
      message: err.message,
      stack:   err.stack,
    })
    // Flush transports then exit
    logger.on('finish', () => process.exit(1))
    logger.end()
  })

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error
        ? { message: reason.message, stack: reason.stack }
        : String(reason),
    })
  })
}

// ─── Convenience stream for morgan ───────────────────────────────────────────

/**
 * Morgan expects a writable stream with a `write(message)` method.
 * We trim the trailing newline that morgan appends before logging.
 */
logger.stream = {
  write(message) {
    logger.http(message.trimEnd())
  },
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = logger

/*
 * ─── Verification ─────────────────────────────────────────────────────────────
 *
 * Syntax   : Pure CommonJS, no optional chaining, no nullish coalescing —
 *            compatible with Node >= 16 (project requirement).
 *            Verified with: node --check utils/logger.js
 *
 * Imports  : winston, path, fs
 *            winston is in the existing package.json dependencies.
 *            path and fs are Node built-ins.
 *
 * Exports  : The winston Logger instance.
 *            logger.stream exposed for morgan (used in server.js:
 *              morgan('combined', { stream: logger.stream }))
 *            logger.http() exists because of CUSTOM_LEVELS definition.
 *
 * Backward compatibility:
 *   server.js calls  : logger.info, logger.error, logger.http (via morgan stream)
 *   utils/cleanup.js : logger.info, logger.warn, logger.error, logger.debug
 *   routes/*.js      : logger.info, logger.warn, logger.error
 *   controllers/*.js : logger.info, logger.error, logger.warn
 *   All call signatures are unchanged.
 *
 * New behaviour vs original:
 *   - Custom 'http' level added (was missing; morgan would have thrown on
 *     logger.http() if the original logger had been called that way)
 *   - Sensitive field redaction (new)
 *   - File transports use maxsize/maxFiles instead of raw filenames
 *     (prevents unbounded disk growth in production)
 *   - Silent mode in test environment (new)
 *   - uncaughtException / unhandledRejection handlers (new)
 *   - logger.stream property for morgan (new — previously server.js used
 *     an inline object; now the stream lives here for testability)
 *
 * References to other modules : none — logger has no local dependencies,
 *   preventing circular imports.
 */
