/*
  logger.js

  Simple logging utility with log levels
*/

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
}

const LOG_LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG']

class Logger {
  constructor () {
    // Default to INFO level, or use environment variable
    const envLevel = process.env.LOG_LEVEL || 'INFO'
    this.level = LOG_LEVELS[envLevel.toUpperCase()] || LOG_LEVELS.INFO
  }

  _log (level, message, ...args) {
    if (level <= this.level) {
      const timestamp = new Date().toISOString()
      const levelName = LOG_LEVEL_NAMES[level]
      console.log(`[${timestamp}] [${levelName}]`, message, ...args)
    }
  }

  error (message, ...args) {
    this._log(LOG_LEVELS.ERROR, message, ...args)
  }

  warn (message, ...args) {
    this._log(LOG_LEVELS.WARN, message, ...args)
  }

  info (message, ...args) {
    this._log(LOG_LEVELS.INFO, message, ...args)
  }

  debug (message, ...args) {
    this._log(LOG_LEVELS.DEBUG, message, ...args)
  }
}

module.exports = new Logger()
