/*
  query-builder-test.js

  Unit tests for internal query-building functions.
  These tests verify SQL generation, input sanitization,
  and geometry processing without a live Databricks connection.
*/

const test = require('tape')
const Model = require('../src/model')
const {
  isValidTableName,
  buildCountQuery,
  buildIdsQuery,
  buildExtentQuery,
  buildQuery,
  buildSelectClause,
  buildBboxFilter,
  buildTimeFilter,
  sanitizeOrderBy,
  translateWithSTFunctions,
  calculateExtent,
  getAllCoordinates,
  mapDatabricksToEsriFieldType,
  checkRateLimit,
  pushValidatedWhere
} = Model._internals

// ============================================================================
// isValidTableName
// ============================================================================

test('isValidTableName - accepts valid table names', function (t) {
  t.ok(isValidTableName('catalog.schema.table'), 'three-level namespace')
  t.ok(isValidTableName('schema.table'), 'two-level namespace')
  t.ok(isValidTableName('my_catalog.my_schema.my_table'), 'underscores')
  t.ok(isValidTableName('cat1.sch2.tbl3'), 'alphanumeric')
  t.end()
})

test('isValidTableName - rejects invalid table names', function (t) {
  t.notOk(isValidTableName('single_name'), 'single name without dots')
  t.notOk(isValidTableName('a.b.c.d'), 'four-level namespace')
  t.notOk(isValidTableName('has spaces.schema.table'), 'spaces')
  t.notOk(isValidTableName('has-dashes.schema.table'), 'dashes')
  t.notOk(isValidTableName(''), 'empty string')
  t.notOk(isValidTableName('.schema.table'), 'leading dot')
  t.notOk(isValidTableName('catalog..table'), 'empty part')
  t.end()
})

// ============================================================================
// sanitizeOrderBy
// ============================================================================

test('sanitizeOrderBy - accepts valid ORDER BY clauses', function (t) {
  t.equal(sanitizeOrderBy('name'), 'name', 'single column')
  t.equal(sanitizeOrderBy('name ASC'), 'name ASC', 'column with ASC')
  t.equal(sanitizeOrderBy('name DESC'), 'name DESC', 'column with DESC')
  t.equal(sanitizeOrderBy('name asc'), 'name ASC', 'lowercase direction')
  t.equal(sanitizeOrderBy('col1, col2'), 'col1, col2', 'multiple columns')
  t.equal(sanitizeOrderBy('col1 ASC, col2 DESC'), 'col1 ASC, col2 DESC', 'multiple with directions')
  t.equal(sanitizeOrderBy('_private'), '_private', 'underscore prefix')
  t.end()
})

test('sanitizeOrderBy - rejects invalid ORDER BY clauses', function (t) {
  t.throws(function () { sanitizeOrderBy('name; DROP TABLE foo') }, /Invalid/, 'SQL injection')
  t.throws(function () { sanitizeOrderBy('') }, /Invalid/, 'empty string')
  t.throws(function () { sanitizeOrderBy('1badcol') }, /Invalid/, 'starts with number')
  t.throws(function () { sanitizeOrderBy('col ASCENDING') }, /Invalid/, 'invalid direction word')
  t.equal(sanitizeOrderBy('name, '), 'name', 'trailing comma is trimmed gracefully')
  t.end()
})

// ============================================================================
// buildSelectClause
// ============================================================================

test('buildSelectClause - wildcard fields with geometry', function (t) {
  var result = buildSelectClause('*', true)
  t.ok(result.includes('*'), 'includes wildcard')
  t.ok(result.includes('ST_AsGeoJSON'), 'includes geometry conversion')
  t.ok(result.includes('__geojson__'), 'includes geojson alias')
  t.end()
})

test('buildSelectClause - wildcard fields without geometry', function (t) {
  var result = buildSelectClause('*', false)
  t.equal(result, '*', 'just wildcard')
  t.end()
})

test('buildSelectClause - specific fields with geometry', function (t) {
  var result = buildSelectClause('name,status', true)
  t.ok(result.includes('name, status'), 'includes field names')
  t.ok(result.includes('ST_AsGeoJSON'), 'includes geometry conversion')
  t.end()
})

test('buildSelectClause - specific fields without geometry', function (t) {
  var result = buildSelectClause('name,status', false)
  t.equal(result, 'name, status', 'just field names')
  t.end()
})

test('buildSelectClause - undefined outFields defaults to wildcard', function (t) {
  var result = buildSelectClause(undefined, true)
  t.ok(result.includes('*'), 'defaults to wildcard')
  t.ok(result.includes('ST_AsGeoJSON'), 'includes geometry')
  t.end()
})

test('buildSelectClause - rejects invalid field names', function (t) {
  t.throws(function () { buildSelectClause('name; DROP TABLE foo', true) }, /Invalid/, 'SQL injection in outFields')
  t.throws(function () { buildSelectClause('1bad', true) }, /Invalid/, 'invalid field name')
  t.end()
})

// ============================================================================
// buildCountQuery
// ============================================================================

test('buildCountQuery - basic count', function (t) {
  var sql = buildCountQuery('cat.sch.tbl', {})
  t.equal(sql, 'SELECT COUNT(*) as cnt FROM cat.sch.tbl', 'simple count')
  t.end()
})

test('buildCountQuery - with WHERE clause', function (t) {
  var sql = buildCountQuery('cat.sch.tbl', { where: "status = 'active'" })
  t.ok(sql.includes('WHERE'), 'includes WHERE')
  t.ok(sql.includes("(status = 'active')"), 'includes condition')
  t.end()
})

test('buildCountQuery - with bbox geometry', function (t) {
  var sql = buildCountQuery('cat.sch.tbl', { geometry: '-122,37,-121,38' })
  t.ok(sql.includes('WHERE'), 'includes WHERE')
  t.ok(sql.includes('ST_Intersects'), 'includes spatial filter')
  t.end()
})

test('buildCountQuery - rejects SQL injection in WHERE', function (t) {
  t.throws(function () {
    buildCountQuery('cat.sch.tbl', { where: '1=1; DROP TABLE foo' })
  }, /Invalid WHERE/, 'rejects injection')
  t.end()
})

// ============================================================================
// buildIdsQuery
// ============================================================================

test('buildIdsQuery - basic IDs query', function (t) {
  var sql = buildIdsQuery('cat.sch.tbl', {})
  t.ok(sql.startsWith('SELECT objectid FROM cat.sch.tbl'), 'selects objectid')
  t.ok(sql.includes('ORDER BY objectid'), 'default order by objectid')
  t.ok(sql.includes('LIMIT'), 'includes limit')
  t.end()
})

test('buildIdsQuery - with pagination', function (t) {
  var sql = buildIdsQuery('cat.sch.tbl', { resultOffset: '10', resultRecordCount: '5' })
  t.ok(sql.includes('LIMIT 5'), 'respects record count')
  t.ok(sql.includes('OFFSET 10'), 'respects offset')
  t.end()
})

test('buildIdsQuery - with custom orderBy', function (t) {
  var sql = buildIdsQuery('cat.sch.tbl', { orderByFields: 'name DESC' })
  t.ok(sql.includes('ORDER BY name DESC'), 'uses custom order')
  t.end()
})

test('buildIdsQuery - with WHERE', function (t) {
  var sql = buildIdsQuery('cat.sch.tbl', { where: 'pop > 1000' })
  t.ok(sql.includes('WHERE (pop > 1000)'), 'includes WHERE clause')
  t.end()
})

// ============================================================================
// buildExtentQuery
// ============================================================================

test('buildExtentQuery - basic extent', function (t) {
  var sql = buildExtentQuery('cat.sch.tbl', {})
  t.ok(sql.includes('ST_XMin'), 'includes xmin')
  t.ok(sql.includes('ST_YMin'), 'includes ymin')
  t.ok(sql.includes('ST_XMax'), 'includes xmax')
  t.ok(sql.includes('ST_YMax'), 'includes ymax')
  t.ok(sql.includes('FROM cat.sch.tbl'), 'includes table name')
  t.end()
})

test('buildExtentQuery - with WHERE', function (t) {
  var sql = buildExtentQuery('cat.sch.tbl', { where: "state = 'CA'" })
  t.ok(sql.includes('WHERE'), 'includes WHERE')
  t.ok(sql.includes("(state = 'CA')"), 'includes condition')
  t.end()
})

// ============================================================================
// buildQuery (main query builder)
// ============================================================================

test('buildQuery - basic query with defaults', function (t) {
  var sql = buildQuery('cat.sch.tbl', {}, 'test-id')
  t.ok(sql.includes('SELECT *'), 'selects all fields')
  t.ok(sql.includes('ST_AsGeoJSON'), 'includes geometry')
  t.ok(sql.includes('FROM cat.sch.tbl'), 'includes table')
  t.ok(sql.includes('LIMIT'), 'includes limit')
  t.end()
})

test('buildQuery - with WHERE clause', function (t) {
  var sql = buildQuery('cat.sch.tbl', { where: "name = 'test'" }, 'test-id')
  t.ok(sql.includes("WHERE (name = 'test')"), 'includes WHERE')
  t.end()
})

test('buildQuery - with outFields', function (t) {
  var sql = buildQuery('cat.sch.tbl', { outFields: 'name,status' }, 'test-id')
  t.ok(sql.includes('name, status'), 'includes specific fields')
  t.end()
})

test('buildQuery - without geometry', function (t) {
  var sql = buildQuery('cat.sch.tbl', { returnGeometry: 'false' }, 'test-id')
  t.notOk(sql.includes('ST_AsGeoJSON'), 'no geometry conversion')
  t.notOk(sql.includes('__geojson__'), 'no geojson alias')
  t.end()
})

test('buildQuery - with pagination', function (t) {
  var sql = buildQuery('cat.sch.tbl', {
    resultOffset: '20',
    resultRecordCount: '10'
  }, 'test-id')
  t.ok(sql.includes('LIMIT 10'), 'respects limit')
  t.ok(sql.includes('OFFSET 20'), 'respects offset')
  t.ok(sql.includes('ORDER BY objectid'), 'adds default order for pagination')
  t.end()
})

test('buildQuery - with orderByFields', function (t) {
  var sql = buildQuery('cat.sch.tbl', { orderByFields: 'name ASC' }, 'test-id')
  t.ok(sql.includes('ORDER BY name ASC'), 'uses custom order')
  t.end()
})

test('buildQuery - with bbox geometry filter', function (t) {
  var sql = buildQuery('cat.sch.tbl', { geometry: '-122,37,-121,38' }, 'test-id')
  t.ok(sql.includes('ST_Intersects'), 'includes spatial filter')
  t.end()
})

test('buildQuery - rejects SQL injection in WHERE', function (t) {
  t.throws(function () {
    buildQuery('cat.sch.tbl', { where: '1=1 UNION SELECT * FROM secrets' }, 'test-id')
  }, /Invalid WHERE/, 'rejects UNION injection')
  t.end()
})

test('buildQuery - rejects SQL injection in outFields', function (t) {
  t.throws(function () {
    buildQuery('cat.sch.tbl', { outFields: 'name; DROP TABLE foo' }, 'test-id')
  }, /Invalid outFields/, 'rejects injection in fields')
  t.end()
})

test('buildQuery - rejects SQL injection in orderByFields', function (t) {
  t.throws(function () {
    buildQuery('cat.sch.tbl', { orderByFields: 'name; DROP TABLE foo' }, 'test-id')
  }, /Invalid/, 'rejects injection in orderBy')
  t.end()
})

// ============================================================================
// buildTimeFilter
// ============================================================================

test('buildTimeFilter - single timestamp', function (t) {
  var filter = buildTimeFilter('1609459200000', 'created_at')
  t.ok(filter, 'returns a filter')
  t.ok(filter.includes('created_at ='), 'uses field name')
  t.ok(filter.includes('TIMESTAMP'), 'uses TIMESTAMP keyword')
  t.end()
})

test('buildTimeFilter - time range', function (t) {
  var filter = buildTimeFilter('1609459200000,1612137600000', 'updated_at')
  t.ok(filter, 'returns a filter')
  t.ok(filter.includes('BETWEEN'), 'uses BETWEEN')
  t.ok(filter.includes('updated_at'), 'uses field name')
  t.end()
})

test('buildTimeFilter - default field name', function (t) {
  var filter = buildTimeFilter('1609459200000')
  t.ok(filter.includes('created_at'), 'defaults to created_at')
  t.end()
})

test('buildTimeFilter - rejects invalid timeField', function (t) {
  t.throws(function () {
    buildTimeFilter('1609459200000', 'field; DROP TABLE foo')
  }, /Invalid timeField/, 'rejects injection in timeField')
  t.end()
})

// ============================================================================
// buildBboxFilter
// ============================================================================

test('buildBboxFilter - valid bbox', function (t) {
  var filter = buildBboxFilter('-122,37,-121,38')
  t.ok(filter, 'returns a filter')
  t.ok(filter.includes('ST_Intersects'), 'uses ST_Intersects')
  t.ok(filter.includes('POLYGON'), 'creates polygon from bbox')
  t.end()
})

test('buildBboxFilter - invalid bbox returns null', function (t) {
  t.equal(buildBboxFilter('not,valid,coords'), null, 'returns null for 3 coords')
  t.equal(buildBboxFilter('a,b,c,d'), null, 'returns null for non-numeric')
  t.end()
})

// ============================================================================
// pushValidatedWhere
// ============================================================================

test('pushValidatedWhere - adds valid clause', function (t) {
  var clauses = []
  pushValidatedWhere(clauses, "status = 'active'")
  t.equal(clauses.length, 1, 'added one clause')
  t.equal(clauses[0], "(status = 'active')", 'wrapped in parens')
  t.end()
})

test('pushValidatedWhere - skips 1=1', function (t) {
  var clauses = []
  pushValidatedWhere(clauses, '1=1')
  t.equal(clauses.length, 0, 'skipped 1=1')
  t.end()
})

test('pushValidatedWhere - skips empty/null', function (t) {
  var clauses = []
  pushValidatedWhere(clauses, '')
  pushValidatedWhere(clauses, null)
  pushValidatedWhere(clauses, undefined)
  t.equal(clauses.length, 0, 'skipped all empty values')
  t.end()
})

test('pushValidatedWhere - throws on injection', function (t) {
  var clauses = []
  t.throws(function () {
    pushValidatedWhere(clauses, '1=1; DROP TABLE foo')
  }, /Invalid WHERE/, 'throws on injection')
  t.end()
})

// ============================================================================
// translateWithSTFunctions
// ============================================================================

test('translateWithSTFunctions - converts rows to GeoJSON', function (t) {
  var rows = [
    { name: 'A', objectid: 1, __geojson__: '{"type":"Point","coordinates":[-122,37]}' },
    { name: 'B', objectid: 2, __geojson__: '{"type":"Point","coordinates":[-121,38]}' }
  ]
  var geojson = translateWithSTFunctions(rows, {})
  t.equal(geojson.type, 'FeatureCollection', 'creates FeatureCollection')
  t.equal(geojson.features.length, 2, 'has 2 features')
  t.equal(geojson.features[0].type, 'Feature', 'feature type correct')
  t.deepEqual(geojson.features[0].geometry.coordinates, [-122, 37], 'geometry parsed')
  t.equal(geojson.features[0].properties.name, 'A', 'properties preserved')
  t.notOk(geojson.features[0].properties.__geojson__, '__geojson__ removed from properties')
  t.end()
})

test('translateWithSTFunctions - handles returnGeometry=false', function (t) {
  var rows = [
    { name: 'A', __geojson__: '{"type":"Point","coordinates":[-122,37]}' }
  ]
  var geojson = translateWithSTFunctions(rows, { returnGeometry: 'false' })
  t.equal(geojson.features[0].geometry, null, 'geometry is null')
  t.end()
})

test('translateWithSTFunctions - handles invalid GeoJSON', function (t) {
  var rows = [
    { name: 'A', __geojson__: 'not-json' }
  ]
  var geojson = translateWithSTFunctions(rows, {})
  t.equal(geojson.features[0].geometry, null, 'geometry is null for bad JSON')
  t.end()
})

test('translateWithSTFunctions - handles missing __geojson__', function (t) {
  var rows = [
    { name: 'A' }
  ]
  var geojson = translateWithSTFunctions(rows, {})
  t.equal(geojson.features[0].geometry, null, 'geometry is null when missing')
  t.end()
})

// ============================================================================
// calculateExtent
// ============================================================================

test('calculateExtent - calculates bounding box from points', function (t) {
  var features = [
    { geometry: { type: 'Point', coordinates: [-122, 37] } },
    { geometry: { type: 'Point', coordinates: [-121, 38] } },
    { geometry: { type: 'Point', coordinates: [-120, 36] } }
  ]
  var extent = calculateExtent(features)
  t.equal(extent.xmin, -122, 'xmin correct')
  t.equal(extent.ymin, 36, 'ymin correct')
  t.equal(extent.xmax, -120, 'xmax correct')
  t.equal(extent.ymax, 38, 'ymax correct')
  t.ok(extent.spatialReference, 'has spatialReference')
  t.end()
})

test('calculateExtent - returns null for no geometries', function (t) {
  var features = [
    { geometry: null },
    { geometry: null }
  ]
  t.equal(calculateExtent(features), null, 'null for no geometries')
  t.end()
})

test('calculateExtent - handles polygons', function (t) {
  var features = [
    {
      geometry: {
        type: 'Polygon',
        coordinates: [[[-122, 37], [-121, 37], [-121, 38], [-122, 38], [-122, 37]]]
      }
    }
  ]
  var extent = calculateExtent(features)
  t.equal(extent.xmin, -122, 'xmin from polygon')
  t.equal(extent.xmax, -121, 'xmax from polygon')
  t.end()
})

// ============================================================================
// getAllCoordinates
// ============================================================================

test('getAllCoordinates - extracts from Point', function (t) {
  var coords = getAllCoordinates({ type: 'Point', coordinates: [-122, 37] })
  t.deepEqual(coords, [[-122, 37]], 'one coordinate pair')
  t.end()
})

test('getAllCoordinates - extracts from LineString', function (t) {
  var coords = getAllCoordinates({
    type: 'LineString',
    coordinates: [[-122, 37], [-121, 38]]
  })
  t.equal(coords.length, 2, 'two coordinate pairs')
  t.end()
})

test('getAllCoordinates - extracts from MultiPolygon', function (t) {
  var coords = getAllCoordinates({
    type: 'MultiPolygon',
    coordinates: [
      [[[-122, 37], [-121, 37], [-121, 38], [-122, 37]]],
      [[[-120, 35], [-119, 35], [-119, 36], [-120, 35]]]
    ]
  })
  t.equal(coords.length, 8, 'all vertices extracted')
  t.end()
})

test('getAllCoordinates - handles GeometryCollection', function (t) {
  var coords = getAllCoordinates({
    type: 'GeometryCollection',
    geometries: [
      { type: 'Point', coordinates: [-122, 37] },
      { type: 'Point', coordinates: [-121, 38] }
    ]
  })
  t.equal(coords.length, 2, 'coordinates from both geometries')
  t.end()
})

// ============================================================================
// mapDatabricksToEsriFieldType
// ============================================================================

test('mapDatabricksToEsriFieldType - maps common types', function (t) {
  t.equal(mapDatabricksToEsriFieldType('INT'), 'esriFieldTypeInteger', 'INT')
  t.equal(mapDatabricksToEsriFieldType('BIGINT'), 'esriFieldTypeBigInteger', 'BIGINT')
  t.equal(mapDatabricksToEsriFieldType('DOUBLE'), 'esriFieldTypeDouble', 'DOUBLE')
  t.equal(mapDatabricksToEsriFieldType('FLOAT'), 'esriFieldTypeDouble', 'FLOAT')
  t.equal(mapDatabricksToEsriFieldType('DECIMAL(10,2)'), 'esriFieldTypeDouble', 'DECIMAL')
  t.equal(mapDatabricksToEsriFieldType('DATE'), 'esriFieldTypeDate', 'DATE')
  t.equal(mapDatabricksToEsriFieldType('TIMESTAMP'), 'esriFieldTypeDate', 'TIMESTAMP')
  t.equal(mapDatabricksToEsriFieldType('BOOLEAN'), 'esriFieldTypeSmallInteger', 'BOOLEAN')
  t.equal(mapDatabricksToEsriFieldType('STRING'), 'esriFieldTypeString', 'STRING')
  t.equal(mapDatabricksToEsriFieldType('VARCHAR(255)'), 'esriFieldTypeString', 'VARCHAR')
  t.equal(mapDatabricksToEsriFieldType(''), 'esriFieldTypeString', 'empty defaults to string')
  t.equal(mapDatabricksToEsriFieldType(null), 'esriFieldTypeString', 'null defaults to string')
  t.end()
})

// ============================================================================
// checkRateLimit
// ============================================================================

test('checkRateLimit - allows requests within limit', function (t) {
  // Use a unique IP to avoid interference from other tests
  var ip = 'test-rate-limit-' + Date.now()
  t.ok(checkRateLimit(ip), 'first request allowed')
  t.ok(checkRateLimit(ip), 'second request allowed')
  t.end()
})
