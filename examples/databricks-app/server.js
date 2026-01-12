/**
 * Minimal Koop Server using Databricks Provider
 *
 * This is an example deployment app. Most users should integrate
 * the provider into their own applications instead of using this.
 *
 * See README.md for more information.
 */

const Koop = require('@koopjs/koop-core')
const databricksProvider = require('@databricks/koop-provider')

// Create Koop instance
const koop = new Koop({ logLevel: process.env.LOG_LEVEL || 'info' })

// Register Databricks provider
koop.register(databricksProvider)

// Start server
const port = process.env.PORT || 8080
koop.server.listen(port, () => {
  console.log(`Koop server listening on port ${port}`)
  console.log(``)
  console.log(`Service info: http://localhost:${port}/databricks/rest/info`)
  console.log(``)
  console.log(`Example FeatureServer URL:`)
  console.log(`http://localhost:${port}/databricks/rest/services/<catalog>.<schema>.<table>/FeatureServer/0`)
  console.log(``)
  console.log(`Environment:`)
  console.log(`  DATABRICKS_SERVER_HOSTNAME: ${process.env.DATABRICKS_SERVER_HOSTNAME || 'NOT SET'}`)
  console.log(`  DATABRICKS_HTTP_PATH: ${process.env.DATABRICKS_HTTP_PATH || 'NOT SET'}`)
  console.log(`  DATABRICKS_TOKEN: ${process.env.DATABRICKS_TOKEN ? '***SET***' : 'NOT SET'}`)
})
