/*
  connection.js

  Singleton connection manager for Databricks SQL.
  Supports PAT (personal access token) and Service Principal (OAuth) authentication.
  Reuses a single client connection to enable connection pooling across requests.
*/

const { DBSQLClient } = require('@databricks/sql')
const logger = require('./logger')

class ConnectionManager {
  constructor () {
    this.client = null
    this.connectPromise = null
    this.cleanupRegistered = false
  }

  /**
   * Lazily connect to Databricks. Reuses the same connection across calls.
   * Detects auth method from environment variables.
   * @returns {Promise<DBSQLClient>}
   */
  async connect () {
    // Return existing connection promise to prevent race conditions
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = this._doConnect()

    try {
      return await this.connectPromise
    } catch (err) {
      // Reset on failure so next call retries
      this.connectPromise = null
      throw err
    }
  }

  async _doConnect () {
    const serverHostname = process.env.DATABRICKS_SERVER_HOSTNAME
    const httpPath = process.env.DATABRICKS_HTTP_PATH

    if (!serverHostname || !httpPath) {
      throw new Error(
        'Missing required connection settings. ' +
        'Set DATABRICKS_SERVER_HOSTNAME and DATABRICKS_HTTP_PATH environment variables.'
      )
    }

    const connectOptions = {
      host: serverHostname,
      path: httpPath
    }

    // Detect auth method
    const clientId = process.env.DATABRICKS_CLIENT_ID
    const clientSecret = process.env.DATABRICKS_CLIENT_SECRET
    const token = process.env.DATABRICKS_TOKEN

    if (clientId && clientSecret) {
      // Service Principal OAuth
      logger.info('Connecting with Service Principal (OAuth) authentication')
      connectOptions.authType = 'databricks-oauth'
      connectOptions.oauthClientId = clientId
      connectOptions.oauthClientSecret = clientSecret
    } else if (token) {
      // Personal Access Token
      logger.info('Connecting with Personal Access Token authentication')
      connectOptions.token = token
    } else {
      throw new Error(
        'No authentication credentials found. ' +
        'Set DATABRICKS_TOKEN for PAT auth, or ' +
        'DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET for Service Principal auth.'
      )
    }

    this.client = new DBSQLClient()
    await this.client.connect(connectOptions)

    // Register cleanup handlers once
    if (!this.cleanupRegistered) {
      this.cleanupRegistered = true
      const cleanup = () => this.close()
      process.once('SIGTERM', cleanup)
      process.once('SIGINT', cleanup)
    }

    logger.info('Successfully connected to Databricks SQL')
    return this.client
  }

  /**
   * Get a new session from the shared client connection.
   * @returns {Promise<IDBSQLSession>}
   */
  async getSession () {
    const client = await this.connect()
    return client.openSession()
  }

  /**
   * Close the client connection and reset state.
   */
  async close () {
    if (this.client) {
      try {
        await this.client.close()
        logger.info('Databricks connection closed')
      } catch (err) {
        logger.error('Error closing Databricks connection:', err)
      }
      this.client = null
      this.connectPromise = null
    }
  }
}

module.exports = new ConnectionManager()
