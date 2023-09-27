/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/usage/provider
*/

const { DBSQLClient } = require('@databricks/sql')

function Model (koop) {}

// Public function to return data from a Databricks SQL Endpoint
// Return: GeoJSON FeatureCollection
//
// req.
//
// URL path parameters:
// req.params.id
// req.params.layer - not used, leave as '0'
// req.params.method - should be 'query'
Model.prototype.getData = function (req, callback) {
  const token = process.env.DATABRICKS_TOKEN
  const serverHostname = process.env.DATABRICKS_SERVER_HOSTNAME
  const httpPath = process.env.DATABRICKS_HTTP_PATH

  if (!token || !serverHostname || !httpPath) {
    throw new Error('Cannot find Server Hostname, HTTP Path, or personal access token. ' +
      'Check the environment variables DATABRICKS_TOKEN, ' +
      'DATABRICKS_SERVER_HOSTNAME, and DATABRICKS_HTTP_PATH.')
  }

  const client = new DBSQLClient()
  const connectOptions = {
    token: token,
    host: serverHostname,
    path: httpPath
  }

  client.connect(connectOptions)
    .then(async client => {
      const session = await client.openSession()
      const table = req.params.id

      const queryOperation = await session.executeStatement(
        `SELECT * FROM ${table}`,
        {
          runAsync: true,
          maxRows: 10 // This option enables the direct results feature.
        }
      )

      const result = await queryOperation.fetchAll()

      await queryOperation.close()

      // hand off the data to Koop
      const geojson = translate(result)
      geojson.metadata = geojson.metadata || {}
      geojson.metadata.idField = 'OBJECTID'
      geojson.metadata.name = `Databricks query against table ${table}`
      callback(null, geojson)

      await session.close()
      await client.close()
    })
    .catch((error) => {
      console.log(error)
    })
}

function translate (input) {
  return {
    type: 'FeatureCollection',
    features: input.map(formatFeature)
  }
}

function formatFeature (inputFeature) {
  const parser = require('wellknown')
  const winder = require('@mapbox/geojson-rewind')
  const parsed = winder(parser.parse(inputFeature.the_geom))
  delete inputFeature.the_geom
  return {
    type: 'Feature',
    geometry: parsed,
    properties: inputFeature
  }
}

module.exports = Model
