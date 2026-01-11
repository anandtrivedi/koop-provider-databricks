/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/usage/provider
*/

const { DBSQLClient } = require('@databricks/sql')
const { v4: uuidv4 } = require('uuid')
const config = require('../config/default.json')
const logger = require('./logger')

const objectId = config.objectId || 'objectid'
const geometryColumn = config.geometryColumn || 'geometry'
const spatialReference = config.spatialReference || 4326
const maxRows = parseInt(config.maxRows) || 10000

logger.info(`Configuration: objectId=${objectId}, geometryColumn=${geometryColumn}, spatialReference=${spatialReference}, maxRows=${maxRows}`)

function Model (koop) {}

// Public function to return data from a Databricks SQL Endpoint
// Return: GeoJSON FeatureCollection
//
// Supports standard Koop query parameters:
// - where: SQL WHERE clause
// - geometry: bbox for spatial filtering
// - outFields: comma-separated list of fields to return
// - returnGeometry: boolean to include/exclude geometry
// - resultOffset: pagination offset
// - resultRecordCount: pagination limit
// - orderByFields: SQL ORDER BY clause
//
// URL path parameters:
// req.params.id - table name (catalog.schema.table)
// req.params.layer - layer index (not used, leave as '0')
// req.params.method - method name (e.g., 'query')
Model.prototype.getData = function (req, callback) {
  const thisTask = uuidv4()
  logger.info(`${thisTask}> Received request: ${req.url}`)

  const token = process.env.DATABRICKS_TOKEN
  const serverHostname = process.env.DATABRICKS_SERVER_HOSTNAME
  const httpPath = process.env.DATABRICKS_HTTP_PATH

  if (!token || !serverHostname || !httpPath) {
    return callback(new Error('Cannot find Server Hostname, HTTP Path, or personal access token. ' +
      'Check the environment variables DATABRICKS_TOKEN, ' +
      'DATABRICKS_SERVER_HOSTNAME, and DATABRICKS_HTTP_PATH.'))
  }

  const table = req.params.id

  // Validate table name to prevent SQL injection
  if (!table || typeof table !== 'string' || !isValidTableName(table)) {
    return callback(new Error('Invalid table name provided'))
  }

  const client = new DBSQLClient()
  const connectOptions = {
    token: token,
    host: serverHostname,
    path: httpPath
  }

  client.connect(connectOptions)
    .then(async client => {
      let session
      let queryOperation

      try {
        session = await client.openSession()

        // Check for special query types
        const returnCountOnly = req.query.returnCountOnly === 'true'
        const returnIdsOnly = req.query.returnIdsOnly === 'true'

        let queryString
        let result

        if (returnCountOnly) {
          // Return only count
          queryString = buildCountQuery(table, req.query)
          logger.info(`${thisTask}> Executing count query: ${queryString}`)

          queryOperation = await session.executeStatement(queryString, { runAsync: true })
          result = await queryOperation.fetchAll()
          await queryOperation.close()
          queryOperation = null

          const count = result[0]?.cnt || 0
          logger.info(`${thisTask}> Count result: ${count}`)

          return callback(null, { count })
        } else if (returnIdsOnly) {
          // Return only IDs
          queryString = buildIdsQuery(table, req.query)
          logger.info(`${thisTask}> Executing IDs query: ${queryString}`)

          queryOperation = await session.executeStatement(queryString, { runAsync: true })
          result = await queryOperation.fetchAll()
          await queryOperation.close()
          queryOperation = null

          const objectIds = result.map(row => row[objectId])
          logger.info(`${thisTask}> Returned ${objectIds.length} IDs`)

          return callback(null, { objectIdFieldName: objectId, objectIds })
        }

        // Regular query
        queryString = buildQuery(table, req.query, thisTask)

        logger.info(`${thisTask}> Executing query: ${queryString}`)

        // Don't use maxRows option - it conflicts with SQL LIMIT
        queryOperation = await session.executeStatement(queryString, { runAsync: true })

        result = await queryOperation.fetchAll()

        await queryOperation.close()
        queryOperation = null

        logger.info(`${thisTask}> Received ${result.length} rows`)

        // Convert to GeoJSON using ST_AsGeoJSON results
        const geojson = translateWithSTFunctions(result, req.query)

        logger.info(`${thisTask}> Translated to ${geojson.features.length} features`)
        if (geojson.features.length > 0) {
          logger.info(`${thisTask}> First feature objectid: ${geojson.features[0].properties[objectId]}`)
        }

        // Add metadata
        geojson.metadata = {
          idField: objectId,
          name: table,
          maxRecordCount: maxRows
        }

        // Tell Koop that we've already applied these filters server-side
        // This prevents Koop from re-applying pagination on already-paginated results
        geojson.filtersApplied = {
          offset: true,    // We handle resultOffset with SQL OFFSET
          limit: true,     // We handle resultRecordCount with SQL LIMIT
          where: true,     // We handle WHERE clauses in SQL
          geometry: true   // We handle bbox filters with ST_Intersects in SQL
        }

        // Add extent if we have features
        if (geojson.features && geojson.features.length > 0) {
          const extent = calculateExtent(geojson.features)
          if (extent) {
            geojson.metadata.extent = extent
          }
        }

        callback(null, geojson)
      } catch (error) {
        logger.error(`${thisTask}> Error executing query:`, error)
        callback(error)
      } finally {
        // Ensure resources are cleaned up
        try {
          if (queryOperation) await queryOperation.close()
          if (session) await session.close()
          await client.close()
        } catch (cleanupError) {
          logger.error(`${thisTask}> Error during cleanup:`, cleanupError)
        }
      }
    })
    .catch((error) => {
      logger.error(`${thisTask}> Error connecting to Databricks:`, error)
      callback(error)
    })
}

// Validate table name format (catalog.schema.table or schema.table)
function isValidTableName (tableName) {
  // Allow alphanumeric, underscores, and dots for three-level namespace
  return /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+){1,2}$/.test(tableName)
}

// Build count query (for returnCountOnly)
function buildCountQuery (table, query) {
  // Build WHERE clause (same as regular query)
  const whereClauses = []

  if (query.where && query.where !== '1=1') {
    whereClauses.push(`(${query.where})`)
  }

  if (query.geometry) {
    const bboxFilter = buildBboxFilter(query.geometry, query.geometryType)
    if (bboxFilter) {
      whereClauses.push(bboxFilter)
    }
  }

  if (query.h3col && query.h3res) {
    const h3Filter = buildH3Filter(query)
    if (h3Filter) {
      whereClauses.push(h3Filter)
    }
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  return `SELECT COUNT(*) as cnt FROM ${table} ${whereClause}`.trim()
}

// Build IDs only query (for returnIdsOnly)
function buildIdsQuery (table, query) {
  const offset = parseInt(query.resultOffset) || 0
  const limit = parseInt(query.resultRecordCount) || maxRows

  // Build WHERE clause (same as regular query)
  const whereClauses = []

  if (query.where && query.where !== '1=1') {
    whereClauses.push(`(${query.where})`)
  }

  if (query.geometry) {
    const bboxFilter = buildBboxFilter(query.geometry, query.geometryType)
    if (bboxFilter) {
      whereClauses.push(bboxFilter)
    }
  }

  if (query.h3col && query.h3res) {
    const h3Filter = buildH3Filter(query)
    if (h3Filter) {
      whereClauses.push(h3Filter)
    }
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  // Order BY for consistent pagination
  let orderByClause = ''
  if (query.orderByFields) {
    orderByClause = `ORDER BY ${sanitizeOrderBy(query.orderByFields)}`
  } else {
    orderByClause = `ORDER BY ${objectId}`
  }

  let sql = `SELECT ${objectId} FROM ${table} ${whereClause} ${orderByClause}`.trim()

  if (limit > 0) {
    sql += ` LIMIT ${limit}`
  }
  if (offset > 0) {
    sql += ` OFFSET ${offset}`
  }

  return sql
}

// Build SQL query with ST functions and filters
function buildQuery (table, query, taskId) {
  const returnGeometry = query.returnGeometry !== 'false'
  const offset = parseInt(query.resultOffset) || 0
  const limit = parseInt(query.resultRecordCount) || maxRows

  // Build SELECT clause
  const selectFields = buildSelectClause(query.outFields, returnGeometry)

  // Build WHERE clause
  const whereClauses = []

  // Add user-provided WHERE clause
  if (query.where && query.where !== '1=1') {
    whereClauses.push(`(${query.where})`)
  }

  // Add bbox spatial filter using ST_Intersects
  if (query.geometry) {
    const bboxFilter = buildBboxFilter(query.geometry, query.geometryType)
    if (bboxFilter) {
      whereClauses.push(bboxFilter)
    }
  }

  // Add H3 filter if provided (legacy support)
  if (query.h3col && query.h3res) {
    const h3Filter = buildH3Filter(query)
    if (h3Filter) {
      whereClauses.push(h3Filter)
    }
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  // Build ORDER BY clause
  // IMPORTANT: Always use ORDER BY for consistent pagination results
  let orderByClause = ''
  if (query.orderByFields) {
    orderByClause = `ORDER BY ${sanitizeOrderBy(query.orderByFields)}`
  } else if (offset > 0 || limit < maxRows) {
    // Default to objectId for consistent pagination
    orderByClause = `ORDER BY ${objectId}`
  }

  // Build complete query
  let sql = `SELECT ${selectFields} FROM ${table} ${whereClause} ${orderByClause}`.trim()

  // Add pagination
  if (limit > 0) {
    sql += ` LIMIT ${limit}`
  }
  if (offset > 0) {
    sql += ` OFFSET ${offset}`
  }

  return sql
}

// Build SELECT clause with ST_AsGeoJSON for geometry
function buildSelectClause (outFields, returnGeometry) {
  let fields

  if (outFields === '*' || !outFields) {
    // Return all fields except geometry column (we'll add it as GeoJSON)
    fields = '*'
  } else {
    // Parse comma-separated field list
    fields = outFields.split(',').map(f => f.trim()).filter(f => f).join(', ')
  }

  if (returnGeometry) {
    // Use ST_AsGeoJSON to convert geometry to GeoJSON in the database
    // This is much more efficient than parsing WKT on the client
    // Wrap WKT string column in ST_GeomFromText for Databricks
    return `${fields}, ST_AsGeoJSON(ST_GeomFromText(${geometryColumn}, ${spatialReference})) as __geojson__`
  }

  return fields
}

// Build bbox filter using ST_Intersects
function buildBboxFilter (geometryString, geometryType) {
  try {
    // Parse bbox: "xmin,ymin,xmax,ymax"
    const coords = geometryString.split(',').map(Number)

    if (coords.length !== 4 || coords.some(isNaN)) {
      logger.warn('Invalid bbox coordinates:', geometryString)
      return null
    }

    const [xmin, ymin, xmax, ymax] = coords

    // Create bbox polygon using ST_GeomFromText
    // Note: POLYGON requires closed ring (first point = last point)
    const wkt = `POLYGON((${xmin} ${ymin}, ${xmax} ${ymin}, ${xmax} ${ymax}, ${xmin} ${ymax}, ${xmin} ${ymin}))`

    // Use ST_Intersects for bbox filtering
    // Wrap WKT string column in ST_GeomFromText for Databricks
    return `ST_Intersects(ST_GeomFromText(${geometryColumn}, ${spatialReference}), ST_GeomFromText('${wkt}', ${spatialReference}))`
  } catch (error) {
    logger.error('Error building bbox filter:', error)
    return null
  }
}

// Build H3 filter (legacy support for existing queries)
function buildH3Filter (query) {
  if (!query.bbox || !query.h3col || !query.h3res) {
    return null
  }

  try {
    const coords = query.bbox.split(',').map(Number)

    if (coords.length !== 4 || coords.some(isNaN)) {
      throw new Error('bbox must contain exactly 4 coordinates')
    }

    // Validate h3 resolution is a valid integer between 0-15
    const h3res = parseInt(query.h3res, 10)
    if (isNaN(h3res) || h3res < 0 || h3res > 15) {
      throw new Error('h3res must be an integer between 0 and 15')
    }

    // Validate h3col is a valid column name (alphanumeric and underscore)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(query.h3col)) {
      throw new Error('h3col must be a valid column name')
    }

    const [xmin, ymin, xmax, ymax] = coords
    const wkt = `POLYGON((${xmin} ${ymin}, ${xmax} ${ymin}, ${xmax} ${ymax}, ${xmin} ${ymax}, ${xmin} ${ymin}))`

    // Use h3_coverash3 function for H3-based spatial indexing
    // Note: h3_coverash3 takes a geometry argument, so we use ST_GeomFromText on the WKT column
    return `array_contains(h3_coverash3(ST_GeomFromText(${geometryColumn}, ${spatialReference}), ${h3res}), ${query.h3col})`
  } catch (error) {
    logger.error('Error generating H3 filter:', error)
    throw error
  }
}

// Sanitize ORDER BY clause
function sanitizeOrderBy (orderBy) {
  // Only allow alphanumeric, underscores, spaces, commas, and ASC/DESC
  if (!/^[a-zA-Z0-9_,\s]+(?:ASC|DESC)?$/i.test(orderBy)) {
    throw new Error('Invalid orderByFields parameter')
  }
  return orderBy
}

// Translate results with ST_AsGeoJSON to GeoJSON
function translateWithSTFunctions (rows, query) {
  const returnGeometry = query.returnGeometry !== 'false'

  return {
    type: 'FeatureCollection',
    features: rows.map(row => {
      let geometry = null

      if (returnGeometry && row.__geojson__) {
        try {
          // Parse the GeoJSON string returned by ST_AsGeoJSON
          geometry = JSON.parse(row.__geojson__)
        } catch (error) {
          logger.error('Error parsing GeoJSON from ST_AsGeoJSON:', error)
          geometry = null
        }
      }

      // Remove the __geojson__ field from properties
      const properties = { ...row }
      delete properties.__geojson__

      return {
        type: 'Feature',
        geometry: geometry,
        properties: properties
      }
    })
  }
}

// Calculate extent from features
function calculateExtent (features) {
  let xmin = Infinity
  let ymin = Infinity
  let xmax = -Infinity
  let ymax = -Infinity

  for (const feature of features) {
    if (!feature.geometry || !feature.geometry.coordinates) continue

    const coords = getAllCoordinates(feature.geometry)
    for (const [x, y] of coords) {
      xmin = Math.min(xmin, x)
      ymin = Math.min(ymin, y)
      xmax = Math.max(xmax, x)
      ymax = Math.max(ymax, y)
    }
  }

  if (xmin === Infinity) return null

  return {
    xmin,
    ymin,
    xmax,
    ymax,
    spatialReference: {
      wkid: spatialReference
    }
  }
}

// Extract all coordinates from a geometry
function getAllCoordinates (geometry) {
  const coords = []

  function extractCoords (geom) {
    if (!geom || !geom.coordinates) return

    switch (geom.type) {
      case 'Point':
        coords.push(geom.coordinates)
        break
      case 'LineString':
      case 'MultiPoint':
        coords.push(...geom.coordinates)
        break
      case 'Polygon':
      case 'MultiLineString':
        geom.coordinates.forEach(ring => coords.push(...ring))
        break
      case 'MultiPolygon':
        geom.coordinates.forEach(polygon => {
          polygon.forEach(ring => coords.push(...ring))
        })
        break
      case 'GeometryCollection':
        geom.geometries.forEach(g => extractCoords(g))
        break
    }
  }

  extractCoords(geometry)
  return coords
}

module.exports = Model
