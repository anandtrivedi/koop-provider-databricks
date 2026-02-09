/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/usage/provider
*/

const { v4: uuidv4 } = require('uuid')
const config = require('../config/default.json')
const logger = require('./logger')
const connectionManager = require('./connection')
const { validateWhereClause, validateColumnName, validateColumnList } = require('./validation')

const objectId = config.objectId || process.env.OBJECT_ID_COLUMN || 'objectid'
const geometryColumn = config.geometryColumn || process.env.GEOMETRY_COLUMN || 'geometry_wkt'
const geometryFormat = (config.geometryFormat || process.env.GEOMETRY_FORMAT || 'wkt').toLowerCase()
const spatialReference = config.spatialReference || parseInt(process.env.SPATIAL_REFERENCE) || 4326
const maxRows = parseInt(config.maxRows) || parseInt(process.env.MAX_ROWS) || 10000
const queryTimeoutSeconds = parseInt(process.env.QUERY_TIMEOUT_SECONDS) || 30
const cacheTTLMs = parseInt(process.env.CACHE_TTL_MS) || 300000
const CACHE_MAX_ENTRIES = 100
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX) || 100
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000

logger.info(`Configuration: objectId=${objectId}, geometryColumn=${geometryColumn}, geometryFormat=${geometryFormat}, spatialReference=${spatialReference}, maxRows=${maxRows}`)

// Simple sliding-window rate limiter (per IP)
const rateLimitStore = {}

function checkRateLimit (ip) {
  const now = Date.now()
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = []
  }
  // Remove expired timestamps
  rateLimitStore[ip] = rateLimitStore[ip].filter(t => now - t < rateLimitWindowMs)
  if (rateLimitStore[ip].length >= rateLimitMax) {
    return false
  }
  rateLimitStore[ip].push(now)
  return true
}

// Clean up stale IPs every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const ip of Object.keys(rateLimitStore)) {
    rateLimitStore[ip] = rateLimitStore[ip].filter(t => now - t < rateLimitWindowMs)
    if (rateLimitStore[ip].length === 0) delete rateLimitStore[ip]
  }
}, 300000).unref()

function Model (koop) {
  // Cache for field metadata: { [table]: { data, timestamp } }
  this.fieldsCache = {}
}

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

  // Rate limiting
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown'
  if (!checkRateLimit(clientIp)) {
    logger.warn(`${thisTask}> Rate limit exceeded for ${clientIp}`)
    const err = new Error('Rate limit exceeded. Try again later.')
    err.code = 429
    return callback(err)
  }

  const table = req.params.id

  // Validate table name to prevent SQL injection
  if (!table || typeof table !== 'string' || !isValidTableName(table)) {
    return callback(new Error('Invalid table name provided'))
  }

  const stmtOpts = { queryTimeout: queryTimeoutSeconds }

  connectionManager.getSession()
    .then(async session => {
      let queryOperation

      try {
        // Check for special query types
        const returnCountOnly = req.query.returnCountOnly === 'true'
        const returnIdsOnly = req.query.returnIdsOnly === 'true'
        const returnExtentOnly = req.query.returnExtentOnly === 'true'

        let queryString
        let result

        if (returnCountOnly) {
          // Return only count
          queryString = buildCountQuery(table, req.query)
          logger.info(`${thisTask}> Executing count query: ${queryString}`)

          queryOperation = await session.executeStatement(queryString, stmtOpts)
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

          queryOperation = await session.executeStatement(queryString, stmtOpts)
          result = await queryOperation.fetchAll()
          await queryOperation.close()
          queryOperation = null

          const objectIds = result.map(row => row[objectId])
          logger.info(`${thisTask}> Returned ${objectIds.length} IDs`)

          return callback(null, { objectIdFieldName: objectId, objectIds })
        } else if (returnExtentOnly) {
          // Return only extent (bounding box)
          queryString = buildExtentQuery(table, req.query)
          logger.info(`${thisTask}> Executing extent query: ${queryString}`)

          queryOperation = await session.executeStatement(queryString, stmtOpts)
          result = await queryOperation.fetchAll()
          await queryOperation.close()
          queryOperation = null

          if (result.length > 0 && result[0].xmin !== null) {
            const extent = {
              xmin: result[0].xmin,
              ymin: result[0].ymin,
              xmax: result[0].xmax,
              ymax: result[0].ymax,
              spatialReference: {
                wkid: spatialReference
              }
            }
            logger.info(`${thisTask}> Extent result: ${JSON.stringify(extent)}`)
            return callback(null, { extent })
          } else {
            logger.info(`${thisTask}> No extent found (empty dataset or invalid geometries)`)
            return callback(null, { extent: null })
          }
        }

        // Regular query
        queryString = buildQuery(table, req.query, thisTask)

        logger.info(`${thisTask}> Executing query: ${queryString}`)

        // Don't use maxRows option - it conflicts with SQL LIMIT
        queryOperation = await session.executeStatement(queryString, stmtOpts)

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

        // Detect and add geometry type from first feature
        if (geojson.features.length > 0 && geojson.features[0].geometry) {
          const geomType = geojson.features[0].geometry.type
          const ESRI_TYPE_MAP = {
            Point: 'esriGeometryPoint',
            MultiPoint: 'esriGeometryMultipoint',
            LineString: 'esriGeometryPolyline',
            MultiLineString: 'esriGeometryPolyline',
            Polygon: 'esriGeometryPolygon',
            MultiPolygon: 'esriGeometryPolygon',
            GeometryCollection: 'esriGeometryPolygon'
          }
          geojson.metadata.geometryType = ESRI_TYPE_MAP[geomType]
          if (!geojson.metadata.geometryType) {
            logger.warn(`Unknown geometry type: ${geomType}, defaulting to esriGeometryPoint`)
            geojson.metadata.geometryType = 'esriGeometryPoint'
          }
          logger.info(`${thisTask}> Detected geometry type: ${geojson.metadata.geometryType}`)
        }

        // Add field metadata from DESCRIBE TABLE
        geojson.metadata.fields = await this.getFieldMetadata(table, session, thisTask)

        // Tell Koop that we've already applied these filters server-side
        // This prevents Koop from re-applying pagination on already-paginated results
        geojson.filtersApplied = {
          offset: true, // We handle resultOffset with SQL OFFSET
          limit: true, // We handle resultRecordCount with SQL LIMIT
          where: true, // We handle WHERE clauses in SQL
          geometry: true // We handle bbox filters with ST_Intersects in SQL
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
        // Clean up query operation and session only (NOT the shared client)
        try {
          if (queryOperation) await queryOperation.close()
          if (session) await session.close()
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

// Build geometry expression based on format (WKT, WKB, GeoJSON, or native GEOMETRY)
function buildGeometryExpression () {
  switch (geometryFormat) {
    case 'wkb':
      // Well-Known Binary format - use ST_GeomFromWKB
      return `ST_GeomFromWKB(${geometryColumn})`

    case 'geojson':
      // GeoJSON string format - use ST_GeomFromGeoJSON
      return `ST_GeomFromGeoJSON(${geometryColumn})`

    case 'geometry':
      // Native Databricks GEOMETRY type - use directly
      return geometryColumn

    case 'wkt':
    default:
      // Well-Known Text format (default) - use ST_GeomFromText
      return `ST_GeomFromText(${geometryColumn}, ${spatialReference})`
  }
}

// Validate and push WHERE clause, throwing on injection attempts
function pushValidatedWhere (whereClauses, where) {
  if (where && where !== '1=1') {
    const result = validateWhereClause(where)
    if (!result.valid) {
      throw new Error(`Invalid WHERE clause: ${result.error}`)
    }
    whereClauses.push(`(${where})`)
  }
}

// Build count query (for returnCountOnly)
function buildCountQuery (table, query) {
  // Build WHERE clause (same as regular query)
  const whereClauses = []

  pushValidatedWhere(whereClauses, query.where)

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

  pushValidatedWhere(whereClauses, query.where)

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

// Build extent query (for returnExtentOnly)
function buildExtentQuery (table, query) {
  // Build WHERE clause (same as regular query)
  const whereClauses = []

  pushValidatedWhere(whereClauses, query.where)

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

  // Use ST_Envelope to get bounding box, then extract min/max coordinates
  // This is more efficient than calculating extent on the client side
  const geomExpr = buildGeometryExpression()

  return `
    SELECT
      MIN(ST_XMin(ST_Envelope(${geomExpr}))) as xmin,
      MIN(ST_YMin(ST_Envelope(${geomExpr}))) as ymin,
      MAX(ST_XMax(ST_Envelope(${geomExpr}))) as xmax,
      MAX(ST_YMax(ST_Envelope(${geomExpr}))) as ymax
    FROM ${table}
    ${whereClause}
  `.trim()
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

  // Add user-provided WHERE clause (validated)
  pushValidatedWhere(whereClauses, query.where)

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

  // Add time filter if provided
  if (query.time) {
    const timeFilter = buildTimeFilter(query.time, query.timeField)
    if (timeFilter) {
      whereClauses.push(timeFilter)
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
    // Validate each field name
    const result = validateColumnList(outFields)
    if (!result.valid) {
      throw new Error(`Invalid outFields: ${result.error}`)
    }
    fields = result.fields.join(', ')
  }

  if (returnGeometry) {
    // Use ST_AsGeoJSON to convert geometry to GeoJSON in the database
    // This is much more efficient than parsing geometry on the client
    // Supports WKT, WKB, and native GEOMETRY types
    const geomExpr = buildGeometryExpression()
    return `${fields}, ST_AsGeoJSON(${geomExpr}) as __geojson__`
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
    // Supports WKT, WKB, and native GEOMETRY types
    const geomExpr = buildGeometryExpression()
    return `ST_Intersects(${geomExpr}, ST_GeomFromText('${wkt}', ${spatialReference}))`
  } catch (error) {
    logger.error('Error building bbox filter:', error)
    return null
  }
}

// Build H3 filter (legacy support for existing queries)
function buildH3Filter (query) {
  // Accept bbox from either query.bbox or query.geometry for consistency
  const bboxString = query.bbox || query.geometry
  if (!bboxString || !query.h3col || !query.h3res) {
    return null
  }

  try {
    const coords = bboxString.split(',').map(Number)

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

    // Use h3_coverash3 function for H3-based spatial indexing
    // Supports WKT, WKB, and native GEOMETRY types
    const geomExpr = buildGeometryExpression()
    return `array_contains(h3_coverash3(${geomExpr}, ${h3res}), ${query.h3col})`
  } catch (error) {
    logger.error('Error generating H3 filter:', error)
    throw error
  }
}

// Build time filter for temporal queries
function buildTimeFilter (timeParam, timeField) {
  // Default time field if not specified
  const field = timeField || 'created_at'

  // Validate timeField column name if user-provided
  if (timeField) {
    const result = validateColumnName(timeField)
    if (!result.valid) {
      throw new Error(`Invalid timeField: ${result.error}`)
    }
  }

  try {
    // Time parameter format: "startTime,endTime" in milliseconds since epoch
    // Can also be a single timestamp
    const times = timeParam.split(',').map(t => parseInt(t.trim(), 10))

    if (times.length === 1) {
      // Single timestamp - exact match
      const timestamp = new Date(times[0]).toISOString()
      return `${field} = TIMESTAMP '${timestamp}'`
    } else if (times.length === 2) {
      // Time range - between start and end
      const startTime = new Date(times[0]).toISOString()
      const endTime = new Date(times[1]).toISOString()
      return `${field} BETWEEN TIMESTAMP '${startTime}' AND TIMESTAMP '${endTime}'`
    }

    logger.warn('Invalid time parameter format:', timeParam)
    return null
  } catch (error) {
    logger.error('Error building time filter:', error)
    return null
  }
}

// Sanitize ORDER BY clause by validating each field+direction pair
function sanitizeOrderBy (orderBy) {
  const parts = orderBy.split(',').map(p => p.trim()).filter(p => p)
  if (parts.length === 0) throw new Error('Invalid orderByFields parameter')

  const sanitized = parts.map(part => {
    // Match: column_name optionally followed by ASC or DESC
    const match = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(ASC|DESC)?$/i)
    if (!match) throw new Error(`Invalid orderByFields parameter: ${part}`)
    return match[2] ? `${match[1]} ${match[2].toUpperCase()}` : match[1]
  })

  return sanitized.join(', ')
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
    if (!geom) return

    if (geom.type === 'GeometryCollection') {
      if (geom.geometries) geom.geometries.forEach(g => extractCoords(g))
      return
    }

    if (!geom.coordinates) return

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
    }
  }

  extractCoords(geometry)
  return coords
}

// Helper: Map Databricks types to Esri field types
function mapDatabricksToEsriFieldType (databricksType) {
  const lowerType = (databricksType || '').toLowerCase()

  if (lowerType.includes('int') || lowerType.includes('long')) {
    if (lowerType.includes('big')) return 'esriFieldTypeBigInteger'
    return 'esriFieldTypeInteger'
  }
  if (lowerType.includes('double') || lowerType.includes('float') || lowerType.includes('decimal')) {
    return 'esriFieldTypeDouble'
  }
  if (lowerType.includes('date') || lowerType.includes('timestamp')) {
    return 'esriFieldTypeDate'
  }
  if (lowerType.includes('boolean')) {
    return 'esriFieldTypeSmallInteger'
  }

  return 'esriFieldTypeString' // Default for STRING, VARCHAR, etc.
}

// Helper: Get field metadata from DESCRIBE TABLE with TTL-based caching
Model.prototype.getFieldMetadata = async function (table, session, taskId) {
  // Check cache first (with TTL)
  const cached = this.fieldsCache[table]
  if (cached && (Date.now() - cached.timestamp < cacheTTLMs)) {
    logger.info(`${taskId}> Using cached field metadata for ${table}`)
    return cached.data
  }

  try {
    logger.info(`${taskId}> Fetching field metadata with DESCRIBE ${table}`)
    const queryOp = await session.executeStatement(`DESCRIBE ${table}`, { queryTimeout: queryTimeoutSeconds })
    const rows = await queryOp.fetchAll()
    await queryOp.close()

    const fields = rows
      .filter(row => {
        // Exclude geometry column and partition columns
        return row.col_name !== geometryColumn &&
               !row.col_name.startsWith('#') &&
               row.col_name !== ''
      })
      .map(row => ({
        name: row.col_name,
        type: mapDatabricksToEsriFieldType(row.data_type),
        alias: row.col_name,
        sqlType: row.data_type,
        nullable: true,
        editable: false,
        domain: null,
        defaultValue: null
      }))

    // Evict oldest entries if cache exceeds max size
    const keys = Object.keys(this.fieldsCache)
    if (keys.length >= CACHE_MAX_ENTRIES) {
      let oldestKey = keys[0]
      let oldestTime = this.fieldsCache[oldestKey].timestamp
      for (let i = 1; i < keys.length; i++) {
        if (this.fieldsCache[keys[i]].timestamp < oldestTime) {
          oldestKey = keys[i]
          oldestTime = this.fieldsCache[keys[i]].timestamp
        }
      }
      delete this.fieldsCache[oldestKey]
    }

    // Cache the result with timestamp
    this.fieldsCache[table] = { data: fields, timestamp: Date.now() }
    logger.info(`${taskId}> Cached ${fields.length} field definitions for ${table}`)

    return fields
  } catch (error) {
    logger.error(`${taskId}> Error fetching field metadata: ${error.message}`)
    return [] // Return empty array on error, don't fail the whole request
  }
}

module.exports = Model

// Export internal functions for unit testing only
Model._internals = {
  isValidTableName,
  buildGeometryExpression,
  pushValidatedWhere,
  buildCountQuery,
  buildIdsQuery,
  buildExtentQuery,
  buildQuery,
  buildSelectClause,
  buildBboxFilter,
  buildH3Filter,
  buildTimeFilter,
  sanitizeOrderBy,
  translateWithSTFunctions,
  calculateExtent,
  getAllCoordinates,
  mapDatabricksToEsriFieldType,
  checkRateLimit
}
