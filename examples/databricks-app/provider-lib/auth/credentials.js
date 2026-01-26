/*
  credentials.js

  Manages API key to Databricks credentials mapping
  Supports both file-based configuration and environment variable fallback
*/

const fs = require('fs')
const path = require('path')
const logger = require('../logger')

// Check if authentication is enabled
function isAuthEnabled () {
  const authMode = process.env.AUTH_MODE || 'disabled'
  return authMode === 'enabled' || authMode === 'api-key'
}

// Load credentials from config file or environment variables
function loadCredentials () {
  const authMode = process.env.AUTH_MODE || 'disabled'

  if (authMode === 'disabled') {
    // Use environment variables (no API key required)
    logger.info('Authentication mode: disabled (using environment variables)')
    return {
      mode: 'disabled',
      default: {
        token: process.env.DATABRICKS_TOKEN,
        serverHostname: process.env.DATABRICKS_SERVER_HOSTNAME,
        httpPath: process.env.DATABRICKS_HTTP_PATH
      }
    }
  }

  // Load API key mapping from config file
  const configPath = path.join(__dirname, '../../config/auth.json')

  if (!fs.existsSync(configPath)) {
    logger.warn('AUTH_MODE=enabled but config/auth.json not found. Falling back to environment variables.')
    return {
      mode: 'disabled',
      default: {
        token: process.env.DATABRICKS_TOKEN,
        serverHostname: process.env.DATABRICKS_SERVER_HOSTNAME,
        httpPath: process.env.DATABRICKS_HTTP_PATH
      }
    }
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    logger.info(`Authentication mode: enabled (loaded ${Object.keys(config.clients || {}).length} API keys)`)
    return {
      mode: 'enabled',
      clients: config.clients || {}
    }
  } catch (error) {
    logger.error('Error loading config/auth.json:', error)
    throw new Error('Failed to load authentication configuration')
  }
}

// Get Databricks credentials for an API key
function getCredentialsForApiKey (apiKey) {
  const credentials = loadCredentials()

  // If auth is disabled, return default credentials (no API key needed)
  if (credentials.mode === 'disabled') {
    return credentials.default
  }

  // Validate API key
  if (!apiKey) {
    return null
  }

  const client = credentials.clients[apiKey]

  if (!client) {
    logger.warn(`Invalid API key provided: ${apiKey.substring(0, 8)}...`)
    return null
  }

  if (client.enabled === false) {
    logger.warn(`Disabled API key used: ${apiKey.substring(0, 8)}... (${client.name})`)
    return null
  }

  logger.info(`Valid API key used: ${client.name || 'Unknown'}`)
  return client.databricks
}

// Validate that credentials are complete
function validateCredentials (credentials) {
  if (!credentials) {
    return false
  }

  if (!credentials.token || !credentials.serverHostname || !credentials.httpPath) {
    logger.error('Incomplete Databricks credentials')
    return false
  }

  return true
}

module.exports = {
  isAuthEnabled,
  loadCredentials,
  getCredentialsForApiKey,
  validateCredentials
}
