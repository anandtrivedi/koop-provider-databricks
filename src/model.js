/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/usage/provider
*/

const { DBSQLClient } = require('@databricks/sql')
const { default: bboxPolygon } = require('@turf/bbox-polygon')
const proj = require('@turf/projection')
const { v4: uuidv4 } = require('uuid')
const parser = require('wellknown')
const winder = require('@mapbox/geojson-rewind')
const config = require('../config/default.json')

const objectId = config.objectId
const geometryColumn = config.geometryColumn
const sridColumn = config.sridColumn
const tableName = config.tableName
console.log('Geometry column is ' + geometryColumn + '; SRID is ' + sridColumn + 'tableName is ' + tableName)


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
  const thisTask = uuidv4()
  console.log(`${thisTask}> Received request: ${req.url}`)

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
      const h3filter = generateH3Filter(req.query)
      const queryString = `SELECT * FROM ${table} ${h3filter}`

      console.log(`${thisTask}> Querying endpoint: ${queryString}`)

      const queryOperation = await session.executeStatement(
        queryString,
        {
          runAsync: true,
          maxRows: 10 // This option enables the direct results feature.
        }
      )

      const result = await queryOperation.fetchAll()

      await queryOperation.close()

      console.log(`${thisTask}> Received result (${result.length} rows)`)

      // hand off the data to Koop
      const geojson = translate(result)
      geojson.metadata = geojson.metadata || {}
      geojson.metadata.idField = objectId
      geojson.metadata.name = table
      callback(null, geojson)

      await session.close()
      await client.close()
    })
    .catch((error) => {
      console.log(error)
    })
}

function generateH3Filter (query) {
  if (query !== undefined && 'bbox' in query && 'h3col' in query && 'h3res' in query) {
    const stringEnvelope3857 = query.bbox.split(',')
    const numEnvelope3857 = stringEnvelope3857.map(Number)
    const poly3857 = bboxPolygon(numEnvelope3857).geometry
    const poly4326 = proj.toWgs84(poly3857)
    const polyJSON = JSON.stringify(poly4326)
    return `WHERE array_contains(h3_coverash3('${polyJSON}', ${query.h3res}), ${query.h3col})`
  }
  return ''
}

function translate (input) {
  return {
    type: 'FeatureCollection',
    features: input.map(formatFeature)
  }
}

function formatFeature (inputFeature) {
  const parsed = winder(parser.parse(`${inputFeature[sridColumn]};${inputFeature[geometryColumn]}`))
  delete inputFeature.the_geom
  return {
    type: 'Feature',
    geometry: parsed,
    properties: inputFeature
  }
}

module.exports = Model
