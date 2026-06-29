const fs = require('fs')
const path = require('path')
const cron = require('node-cron')
const logger = require('./logger')

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const FILE_TTL_HOURS = parseInt(process.env.FILE_TTL_HOURS || '1', 10)
const FILE_TTL_MS = FILE_TTL_HOURS * 60 * 60 * 1000

/**
 * Delete all files in UPLOAD_DIR older than FILE_TTL_HOURS.
 * Runs on a cron schedule; also exported for on-demand use.
 */
function cleanupOldFiles() {
  const now = Date.now()
  let deleted = 0
  let errors = 0

  try {
    if (!fs.existsSync(UPLOAD_DIR)) return

    const entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })

    for (const entry of entries) {
      // Each job lives in its own sub-directory: uploads/<jobId>/
      if (!entry.isDirectory()) continue
      const jobPath = path.join(UPLOAD_DIR, entry.name)

      try {
        const stat = fs.statSync(jobPath)
        const agMs = now - stat.mtimeMs

        if (agMs > FILE_TTL_MS) {
          fs.rmSync(jobPath, { recursive: true, force: true })
          deleted++
        }
      } catch (err) {
        logger.warn(`cleanup: could not remove ${jobPath}`, { error: err.message })
        errors++
      }
    }

    if (deleted > 0 || errors > 0) {
      logger.info(`File cleanup complete`, { deleted, errors })
    }
  } catch (err) {
    logger.error('File cleanup failed', { error: err.message })
  }
}

/**
 * Register a cron job that runs cleanup every 30 minutes.
 */
function startCleanupScheduler() {
  cleanupOldFiles() // run immediately on startup

  cron.schedule('*/30 * * * *', () => {
    logger.debug('Running scheduled file cleanup…')
    cleanupOldFiles()
  })

  logger.info(`File cleanup scheduler started (TTL = ${FILE_TTL_HOURS}h)`)
}

module.exports = { cleanupOldFiles, startCleanupScheduler }
