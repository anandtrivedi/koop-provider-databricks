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
  version: require('../package.json').version
}

// Add authentication methods if auth is enabled
if (isAuthEnabled()) {
  provider.authenticate = require('./auth/authenticate')
  provider.authorize = require('./auth/authorize')
  provider.authenticationSpecification = require('./auth/authentication-specification')
  console.log('Authentication enabled for Databricks provider')
} else {
  console.log('Authentication disabled for Databricks provider (using environment variables)')
}

module.exports = provider
