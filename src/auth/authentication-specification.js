/*
  authentication-specification.js

  Provides authentication configuration to Koop
  Tells ArcGIS clients about token-based authentication
*/

module.exports = () => {
  return {
    // Use HTTPS for token endpoints (set KOOP_AUTH_HTTP=true to allow HTTP)
    useHttp: process.env.KOOP_AUTH_HTTP === 'true'
  }
}
