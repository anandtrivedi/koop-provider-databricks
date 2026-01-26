/*
  authorize.js

  Validates session tokens on each request to the FeatureServer
  Extracts token from query parameters or Authorization header
*/

const authenticate = require('./authenticate')
const { isAuthEnabled } = require('./credentials')
const logger = require('../logger')

module.exports = async (req) => {
  // If auth is disabled, allow all requests
  if (!isAuthEnabled()) {
    return {}
  }

  // Extract token from multiple possible locations
  let token = null

  // 1. Check query parameter (?token=xxx) - most common for ArcGIS
  if (req.query && req.query.token) {
    token = req.query.token
  }

  // 2. Check Authorization header (Bearer token)
  if (!token && req.headers && req.headers.authorization) {
    const authHeader = req.headers.authorization
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else if (authHeader.startsWith('Token ')) {
      token = authHeader.substring(6)
    }
  }

  // 3. Check request body
  if (!token && req.body && req.body.token) {
    token = req.body.token
  }

  // No token provided
  if (!token) {
    logger.warn('Request missing authentication token')
    const error = new Error('Not Authorized: Missing authentication token. Obtain a token from /databricks/tokens/')
    error.code = 401
    throw error
  }

  // Validate token
  const tokenData = authenticate.tokenStore.get(token)

  if (!tokenData) {
    logger.warn(`Request with invalid token: ${token.substring(0, 8)}...`)
    const error = new Error('Not Authorized: Invalid or expired token')
    error.code = 401
    throw error
  }

  // Check if token is expired
  if (tokenData.expiresAt < Date.now()) {
    logger.warn(`Request with expired token: ${token.substring(0, 8)}...`)
    authenticate.tokenStore.delete(token) // Clean up
    const error = new Error('Not Authorized: Token has expired. Obtain a new token from /databricks/tokens/')
    error.code = 401
    throw error
  }

  // Token is valid - attach credentials to request for use in model
  req.databricksCredentials = tokenData.credentials

  logger.debug(`Request authorized with token: ${token.substring(0, 8)}...`)

  return {}
}
