/*
  authenticate.js

  Issues session tokens when valid API keys are provided
  This creates the /databricks/tokens/ endpoint that ArcGIS clients use to get tokens
*/

const crypto = require('crypto')
const { getCredentialsForApiKey, validateCredentials, isAuthEnabled } = require('./credentials')
const logger = require('../logger')

// In-memory token store (in production, use Redis or similar)
const tokenStore = new Map()

// Token expiration time (in seconds)
const TOKEN_EXPIRATION = parseInt(process.env.TOKEN_EXPIRATION_SECONDS) || 3600 // 1 hour default

const authenticate = async (req) => {
  // If auth is disabled, return error (shouldn't reach here)
  if (!isAuthEnabled()) {
    const error = new Error('Authentication is disabled. No token required.')
    error.code = 400
    throw error
  }

  // Get API key from request body or query parameters
  // ArcGIS clients typically send: { username: apiKey, password: '' } or { token: apiKey }
  const apiKey = req.body?.username || req.body?.apiKey || req.body?.token || req.query?.apiKey

  if (!apiKey) {
    logger.warn('Token request missing API key')
    const error = new Error('Missing API key. Provide apiKey in request body or query parameter.')
    error.code = 401
    throw error
  }

  // Validate API key and get Databricks credentials
  const credentials = getCredentialsForApiKey(apiKey)

  if (!credentials || !validateCredentials(credentials)) {
    logger.warn(`Token request with invalid API key: ${apiKey.substring(0, 8)}...`)
    const error = new Error('Invalid API key')
    error.code = 401
    throw error
  }

  // Generate session token
  const sessionToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + (TOKEN_EXPIRATION * 1000)

  // Store token with associated credentials
  tokenStore.set(sessionToken, {
    apiKey,
    credentials,
    expiresAt,
    createdAt: Date.now()
  })

  logger.info(`Issued session token for API key: ${apiKey.substring(0, 8)}... (expires in ${TOKEN_EXPIRATION}s)`)

  // Clean up expired tokens periodically
  cleanupExpiredTokens()

  // Return token and expiration (in milliseconds for ArcGIS compatibility)
  return {
    token: sessionToken,
    expires: expiresAt,
    ssl: process.env.KOOP_AUTH_HTTP !== 'true' // Use HTTPS by default
  }
}

// Clean up expired tokens from memory
function cleanupExpiredTokens () {
  const now = Date.now()
  let cleaned = 0

  for (const [token, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(token)
      cleaned++
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired tokens`)
  }
}

// Export authenticate function as default and tokenStore as named export
module.exports = authenticate
module.exports.tokenStore = tokenStore
