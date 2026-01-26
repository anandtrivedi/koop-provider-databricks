/*
  index.js

  This file is required. It's role is to specify configuration settings.

  Documentation: http://koopjs.github.io/docs/usage/provider
*/

require('dotenv').config()

const { isAuthEnabled } = require('./auth/credentials')

// Define the provider path
// /:name/:hosts?/:disableIdParam?/FeatureServer/:layer/:method
// e.g. /example/FeatureServer/0/query
const provider = {
  type: 'provider',
  name: 'databricks',
  hosts: false, // if true, also adds disableIdParam
  disableIdParam: false, // if true, adds to path and req.params
  Controller: require('./controller'),
  Model: require('./model'),
  routes: require('./routes'),
  version: require('../package.json').version,
  // Always include authentication methods so Koop can discover them
  // They will check internally if auth is enabled
  authenticate: require('./auth/authenticate'),
  authorize: require('./auth/authorize'),
  authenticationSpecification: require('./auth/authentication-specification')
}

// Log authentication status
if (isAuthEnabled()) {
  console.log('Authentication enabled for Databricks provider')
} else {
  console.log('Authentication disabled for Databricks provider (using environment variables)')
}

module.exports = provider
