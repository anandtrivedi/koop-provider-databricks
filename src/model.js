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

// Environment variables take precedence over config/default.json
const objectId = process.env.OBJECT_ID_COLUMN || config.objectId || 'objectid'
const geometryColumn = process.env.GEOMETRY_COLUMN || config.geometryColumn || 'geometry_wkt'
const geometryFormat = (process.env.GEOMETRY_FORMAT || config.geometryFormat || 'wkt').toLowerCase()
const spatialReference = parseInt(process.env.SPATIAL_REFERENCE) || config.spatialReference || 4326
const maxRows = parseInt(process.env.MAX_ROWS) || parseInt(config.maxRows) || 10000
const queryTimeoutSeconds = parseInt(process.env.QUERY_TIMEOUT_SECONDS) || 30
const cacheTTLMs = parseInt(process.env.CACHE_TTL_MS) || 300000
const CACHE_MAX_ENTRIES = 100
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX) || 100
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000

logger.info(`Configuration: objectId=${objectId}, geometryColumn=${geometryColumn}, geometryFormat=${geometryFormat}, spatialReference=${spatialReference}, maxRows=${maxRows}`)

// Ring buffer of recently executed queries, exposed as Model.recentQueries
// for diagnostics and demo UIs (e.g. a query inspector panel)
const RECENT_QUERIES_MAX = 50
const recentQueries = []

function recordQuery (entry) {
  recentQueries.push(entry)
  if (recentQueries.length > RECENT_QUERIES_MAX) recentQueries.shift()
}

// Execute a statement, fetch all rows, and record it in the query log
async function executeAndRecord (session, sql, kind, taskId) {
  const started = Date.now()
  const op = await session.executeStatement(sql, { queryTimeout: queryTimeoutSeconds })
  const rows = await op.fetchAll()
  await op.close()
  recordQuery({
    at: new Date(started).toISOString(),
    taskId,
    kind,
    sql,
    durationMs: Date.now() - started,
    rows: rows.length
  })
  return rows
}

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

  // Rate limiting. Behind a load balancer req.ip is the LB address (Express
  // 'trust proxy' is not set by Koop), so prefer the first X-Forwarded-For hop.
  const forwardedFor = req.headers && req.headers['x-forwarded-for']
  const clientIp = (typeof forwardedFor === 'string' && forwardedFor.split(',')[0].trim()) ||
    req.ip || req.socket?.remoteAddress || 'unknown'
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

  connectionManager.getSession()
    .then(async session => {
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

          result = await executeAndRecord(session, queryString, 'count', thisTask)

          const count = result[0]?.cnt || 0
          logger.info(`${thisTask}> Count result: ${count}`)

          return callback(null, { count })
        } else if (returnIdsOnly) {
          // Return only IDs
          queryString = buildIdsQuery(table, req.query)
          logger.info(`${thisTask}> Executing IDs query: ${queryString}`)

          result = await executeAndRecord(session, queryString, 'ids', thisTask)

          const objectIds = result.map(row => row[objectId])
          logger.info(`${thisTask}> Returned ${objectIds.length} IDs`)

          return callback(null, { objectIdFieldName: objectId, objectIds })
        } else if (returnExtentOnly) {
          // Return only extent (bounding box)
          queryString = buildExtentQuery(table, req.query)
          logger.info(`${thisTask}> Executing extent query: ${queryString}`)

          result = await executeAndRecord(session, queryString, 'extent', thisTask)

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
        result = await executeAndRecord(session, queryString, 'features', thisTask)

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
        // This prevents Koop from re-applying pagination on already-paginated results.
        // Only claim the geometry filter when we actually built one — for unsupported
        // geometry shapes (e.g. polygon filters) Koop falls back to filtering in-memory.
        geojson.filtersApplied = {
          offset: true, // We handle resultOffset with SQL OFFSET
          limit: true, // We handle resultRecordCount with SQL LIMIT
          where: true, // We handle WHERE clauses in SQL
          geometry: !req.query.geometry ||
            buildBboxFilter(req.query.geometry, req.query.geometryType, req.query.inSR) !== null
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
        // Clean up the session only (NOT the shared client)
        try {
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
      // Well-Known Binary format - use ST_GeomFromWKB.
      // The SRID argument is required so ST_Intersects against the
      // bbox geometry (SRID 4326) doesn't fail on an SRID mismatch.
      return `ST_GeomFromWKB(${geometryColumn}, ${spatialReference})`

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

// Parse resultRecordCount, clamping to [1, maxRows]. Invalid, negative, or
// oversized values fall back to maxRows so clients can't bypass the row cap.
function parseResultRecordCount (value) {
  const parsed = parseInt(value)
  if (isNaN(parsed) || parsed <= 0) return maxRows
  return Math.min(parsed, maxRows)
}

// Parse resultOffset, treating invalid or negative values as 0
function parseResultOffset (value) {
  const parsed = parseInt(value)
  if (isNaN(parsed) || parsed < 0) return 0
  return parsed
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

// Build the list of WHERE clauses shared by all query builders:
// user WHERE, bbox spatial filter, H3 filter, and time filter. Keeping this
// in one place ensures returnCountOnly/returnIdsOnly/returnExtentOnly apply the
// exact same filters as the feature query (ArcGIS clients rely on that parity).
function buildWhereClauses (query) {
  const whereClauses = []

  pushValidatedWhere(whereClauses, query.where)

  if (query.geometry) {
    const bboxFilter = buildBboxFilter(query.geometry, query.geometryType, query.inSR)
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

  if (query.time) {
    const timeFilter = buildTimeFilter(query.time, query.timeField)
    if (timeFilter) {
      whereClauses.push(timeFilter)
    }
  }

  return whereClauses
}

// Build count query (for returnCountOnly)
function buildCountQuery (table, query) {
  const whereClauses = buildWhereClauses(query)
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  return `SELECT COUNT(*) as cnt FROM ${table} ${whereClause}`.trim()
}

// Build IDs only query (for returnIdsOnly)
function buildIdsQuery (table, query) {
  const offset = parseResultOffset(query.resultOffset)
  const limit = parseResultRecordCount(query.resultRecordCount)

  const whereClauses = buildWhereClauses(query)
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  // Order BY for consistent pagination
  let orderByClause = ''
  if (query.orderByFields) {
    orderByClause = `ORDER BY ${sanitizeOrderBy(query.orderByFields)}`
  } else {
    orderByClause = `ORDER BY ${objectId}`
  }

  let sql = `SELECT ${objectId} FROM ${table} ${whereClause} ${orderByClause}`.trim()

  sql += ` LIMIT ${limit}`
  if (offset > 0) {
    sql += ` OFFSET ${offset}`
  }

  return sql
}

// Build extent query (for returnExtentOnly)
function buildExtentQuery (table, query) {
  const whereClauses = buildWhereClauses(query)
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
  const offset = parseResultOffset(query.resultOffset)
  const limit = parseResultRecordCount(query.resultRecordCount)

  // Build SELECT clause
  const selectFields = buildSelectClause(query.outFields, returnGeometry)

  const whereClauses = buildWhereClauses(query)
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  // Build ORDER BY clause
  // IMPORTANT: Always use ORDER BY so pagination is deterministic across requests
  let orderByClause = ''
  if (query.orderByFields) {
    orderByClause = `ORDER BY ${sanitizeOrderBy(query.orderByFields)}`
  } else {
    orderByClause = `ORDER BY ${objectId}`
  }

  // Build complete query
  let sql = `SELECT ${selectFields} FROM ${table} ${whereClause} ${orderByClause}`.trim()

  // Add pagination
  sql += ` LIMIT ${limit}`
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

// Convert Web Mercator (EPSG:3857 / 102100) coordinates to WGS84 degrees
function webMercatorToWgs84 (x, y) {
  const R = 6378137
  const lon = (x / R) * (180 / Math.PI)
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)
  return [lon, lat]
}

// Parse the ArcGIS geometry parameter into [xmin, ymin, xmax, ymax] in the
// data's spatial reference. Supports the comma form ("xmin,ymin,xmax,ymax")
// and the JSON envelope/point forms that ArcGIS clients send
// (e.g. {"xmin":...,"spatialReference":{"wkid":102100}}). Koop core may have
// already parsed the JSON form into an object before getData is called.
// Returns null for unsupported geometry filters (e.g. polygon).
function parseBbox (geometryParam, inSR) {
  let coords
  let wkid = parseInt(inSR) || null
  let envelope = null

  if (geometryParam && typeof geometryParam === 'object') {
    envelope = geometryParam
  } else {
    const trimmed = String(geometryParam).trim()
    if (trimmed.startsWith('{')) {
      try {
        envelope = JSON.parse(trimmed)
      } catch (error) {
        return null
      }
    } else {
      coords = trimmed.split(',').map(Number)
    }
  }

  if (envelope) {
    const num = v => (v === null || v === undefined || v === '') ? NaN : Number(v)
    if (['xmin', 'ymin', 'xmax', 'ymax'].every(k => !isNaN(num(envelope[k])))) {
      coords = [num(envelope.xmin), num(envelope.ymin), num(envelope.xmax), num(envelope.ymax)]
    } else if (!isNaN(num(envelope.x)) && !isNaN(num(envelope.y))) {
      coords = [num(envelope.x), num(envelope.y), num(envelope.x), num(envelope.y)]
    } else {
      return null
    }
    if (envelope.spatialReference && envelope.spatialReference.wkid) {
      wkid = envelope.spatialReference.wkid
    }
  }

  if (!coords || coords.length !== 4 || coords.some(c => typeof c !== 'number' || isNaN(c))) {
    return null
  }

  if (wkid === 102100 || wkid === 3857 || wkid === 900913) {
    const [xmin, ymin] = webMercatorToWgs84(coords[0], coords[1])
    const [xmax, ymax] = webMercatorToWgs84(coords[2], coords[3])
    coords = [xmin, ymin, xmax, ymax]
  }

  return coords
}

// Build bbox filter using ST_Intersects
function buildBboxFilter (geometryString, geometryType, inSR) {
  try {
    const coords = parseBbox(geometryString, inSR)

    if (!coords) {
      logger.warn('Unsupported or invalid geometry filter, skipping SQL bbox filter:', geometryString)
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
    // Time parameter format: "startTime,endTime" in milliseconds since epoch.
    // Either end may be "null" for an open-ended range (ArcGIS convention).
    // Can also be a single timestamp.
    const parts = timeParam.split(',').map(t => t.trim())
    const toTimestamp = part => new Date(parseInt(part, 10)).toISOString()
    const isOpen = part => part === '' || part.toLowerCase() === 'null'

    if (parts.length === 1 && !isOpen(parts[0])) {
      // Single timestamp - exact match
      return `${field} = TIMESTAMP '${toTimestamp(parts[0])}'`
    } else if (parts.length === 2) {
      const hasStart = !isOpen(parts[0])
      const hasEnd = !isOpen(parts[1])
      if (hasStart && hasEnd) {
        return `${field} BETWEEN TIMESTAMP '${toTimestamp(parts[0])}' AND TIMESTAMP '${toTimestamp(parts[1])}'`
      } else if (hasStart) {
        return `${field} >= TIMESTAMP '${toTimestamp(parts[0])}'`
      } else if (hasEnd) {
        return `${field} <= TIMESTAMP '${toTimestamp(parts[1])}'`
      }
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
    const rows = await executeAndRecord(session, `DESCRIBE ${table}`, 'describe', taskId)

    // DESCRIBE lists the real columns first; a blank row or '# Partition
    // Information' header starts the metadata sections, which repeat column
    // names — stop there to avoid duplicate field definitions.
    const columnRows = []
    for (const row of rows) {
      if (!row.col_name || row.col_name.startsWith('#')) break
      columnRows.push(row)
    }

    const fields = columnRows
      .filter(row => row.col_name !== geometryColumn)
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

// Recently executed queries (ring buffer) for diagnostics and demo UIs
Model.recentQueries = recentQueries

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
  buildWhereClauses,
  buildBboxFilter,
  parseBbox,
  webMercatorToWgs84,
  parseResultRecordCount,
  parseResultOffset,
  buildH3Filter,
  buildTimeFilter,
  sanitizeOrderBy,
  translateWithSTFunctions,
  calculateExtent,
  getAllCoordinates,
  mapDatabricksToEsriFieldType,
  checkRateLimit,
  executeAndRecord
}
