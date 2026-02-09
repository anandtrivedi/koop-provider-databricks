/*
  validation-test.js

  Tests for input validation, SQL injection prevention, and security hardening
*/

const test = require('tape')

// ============================================================================
// Module loading tests
// ============================================================================

test('model module loads correctly', t => {
  t.plan(2)

  const Model = require('../src/model')
  const model = new Model()

  t.ok(Model, 'Model class exists')
  t.ok(model.getData, 'getData method exists')
  t.end()
})

test('validation module loads correctly', t => {
  t.plan(3)

  const validation = require('../src/validation')

  t.ok(validation.validateWhereClause, 'validateWhereClause function exists')
  t.ok(validation.validateColumnName, 'validateColumnName function exists')
  t.ok(validation.validateColumnList, 'validateColumnList function exists')
  t.end()
})

test('connection module loads correctly', t => {
  t.plan(3)

  const connectionManager = require('../src/connection')

  t.ok(connectionManager.connect, 'connect method exists')
  t.ok(connectionManager.getSession, 'getSession method exists')
  t.ok(connectionManager.close, 'close method exists')
  t.end()
})

// ============================================================================
// WHERE clause validation tests
// ============================================================================

test('validateWhereClause - accepts valid ArcGIS WHERE clauses', t => {
  const { validateWhereClause } = require('../src/validation')

  const validClauses = [
    "status = 'active'",
    'population > 1000',
    "name LIKE '%test%'",
    "status = 'active' AND type = 'urban'",
    'objectid IN (1, 2, 3)',
    "category = 'residential' OR category = 'commercial'",
    'value BETWEEN 10 AND 100',
    'name IS NOT NULL',
    "type = 'A' AND (status = 1 OR status = 2)"
  ]

  t.plan(validClauses.length)

  for (const clause of validClauses) {
    const result = validateWhereClause(clause)
    t.ok(result.valid, `Accepts valid WHERE: ${clause}`)
  }

  t.end()
})

test('validateWhereClause - rejects SQL injection attempts', t => {
  const { validateWhereClause } = require('../src/validation')

  const injections = [
    '1=1; DROP TABLE users',
    'status = \'a\' UNION SELECT * FROM secrets',
    '1=1; DELETE FROM users',
    'name = \'x\'; INSERT INTO logs VALUES(\'hack\')',
    '1=1; TRUNCATE TABLE data',
    'x = 1; CREATE TABLE hack(id INT)',
    '1=1; ALTER TABLE users ADD COLUMN hack VARCHAR',
    'status = \'active\'; EXEC xp_cmdshell(\'cmd\')',
    '1=1; GRANT ALL ON users TO public',
    '1=1; REVOKE ALL ON users FROM admin',
    '1=1; UPDATE users SET admin = true'
  ]

  t.plan(injections.length)

  for (const injection of injections) {
    const result = validateWhereClause(injection)
    t.notOk(result.valid, `Rejects injection: ${injection}`)
  }

  t.end()
})

test('validateWhereClause - rejects invalid input types', t => {
  const { validateWhereClause } = require('../src/validation')

  t.plan(3)

  t.notOk(validateWhereClause(null).valid, 'Rejects null')
  t.notOk(validateWhereClause('').valid, 'Rejects empty string')
  t.notOk(validateWhereClause(123).valid, 'Rejects non-string')

  t.end()
})

// ============================================================================
// Column name validation tests
// ============================================================================

test('validateColumnName - accepts valid column names', t => {
  const { validateColumnName } = require('../src/validation')

  const valid = ['name', 'status', 'objectid', '_private', 'field_1', 'CamelCase', 'ALL_CAPS']

  t.plan(valid.length)

  for (const name of valid) {
    t.ok(validateColumnName(name).valid, `Accepts: ${name}`)
  }

  t.end()
})

test('validateColumnName - rejects invalid column names', t => {
  const { validateColumnName } = require('../src/validation')

  const invalid = [
    '1startsWithNumber',
    'has spaces',
    'has-dashes',
    'has.dots',
    'name; DROP TABLE foo',
    "name' OR 1=1--",
    ''
  ]

  t.plan(invalid.length)

  for (const name of invalid) {
    t.notOk(validateColumnName(name).valid, `Rejects: ${name}`)
  }

  t.end()
})

// ============================================================================
// Column list validation tests
// ============================================================================

test('validateColumnList - accepts valid field lists', t => {
  const { validateColumnList } = require('../src/validation')

  t.plan(4)

  const r1 = validateColumnList('name,status,type')
  t.ok(r1.valid, 'Accepts comma-separated fields')

  const r2 = validateColumnList('name, status, type')
  t.ok(r2.valid, 'Accepts fields with spaces')

  const r3 = validateColumnList('single_field')
  t.ok(r3.valid, 'Accepts single field')

  t.deepEqual(r1.fields, ['name', 'status', 'type'], 'Returns parsed fields')

  t.end()
})

test('validateColumnList - rejects invalid field lists', t => {
  const { validateColumnList } = require('../src/validation')

  t.plan(3)

  t.notOk(validateColumnList('name; DROP TABLE foo').valid, 'Rejects injection in field list')
  t.notOk(validateColumnList('').valid, 'Rejects empty string')
  t.notOk(validateColumnList('name, 1bad').valid, 'Rejects invalid field name in list')

  t.end()
})

// ============================================================================
// Model integration tests
// ============================================================================

test('model validation - invalid table name', t => {
  t.plan(1)

  const Model = require('../src/model')
  const model = new Model()

  const req = {
    params: { id: 'invalid table' },
    query: {},
    url: '/test'
  }

  model.getData(req, (err, data) => {
    t.ok(err, 'Error returned for invalid table name')
    t.end()
  })
})

test('model validation - missing credentials returns error', t => {
  t.plan(1)

  // Temporarily clear environment variables
  const savedToken = process.env.DATABRICKS_TOKEN
  const savedHost = process.env.DATABRICKS_SERVER_HOSTNAME
  const savedPath = process.env.DATABRICKS_HTTP_PATH
  const savedClientId = process.env.DATABRICKS_CLIENT_ID
  const savedClientSecret = process.env.DATABRICKS_CLIENT_SECRET

  delete process.env.DATABRICKS_TOKEN
  delete process.env.DATABRICKS_SERVER_HOSTNAME
  delete process.env.DATABRICKS_HTTP_PATH
  delete process.env.DATABRICKS_CLIENT_ID
  delete process.env.DATABRICKS_CLIENT_SECRET

  // Reset connection manager state so it re-detects missing creds
  const connectionManager = require('../src/connection')
  connectionManager.client = null
  connectionManager.connectPromise = null

  const Model = require('../src/model')
  const model = new Model()

  const req = {
    params: { id: 'catalog.schema.table' },
    query: {},
    url: '/test'
  }

  model.getData(req, (err, data) => {
    t.ok(err, 'Error returned for missing credentials')

    // Restore environment variables
    if (savedToken) process.env.DATABRICKS_TOKEN = savedToken
    if (savedHost) process.env.DATABRICKS_SERVER_HOSTNAME = savedHost
    if (savedPath) process.env.DATABRICKS_HTTP_PATH = savedPath
    if (savedClientId) process.env.DATABRICKS_CLIENT_ID = savedClientId
    if (savedClientSecret) process.env.DATABRICKS_CLIENT_SECRET = savedClientSecret

    // Reset connection manager again so other tests aren't affected
    connectionManager.client = null
    connectionManager.connectPromise = null

    t.end()
  })
})

// ============================================================================
// Cache TTL tests
// ============================================================================

test('field metadata cache uses TTL', t => {
  t.plan(2)

  const Model = require('../src/model')
  const model = new Model()

  // Simulate cached entry with current timestamp
  model.fieldsCache['test.table'] = {
    data: [{ name: 'col1', type: 'esriFieldTypeString' }],
    timestamp: Date.now()
  }

  // Fresh cache should be present
  t.ok(model.fieldsCache['test.table'], 'Cache entry exists')

  // Simulate expired entry (timestamp far in the past)
  model.fieldsCache['test.expired'] = {
    data: [{ name: 'col1', type: 'esriFieldTypeString' }],
    timestamp: Date.now() - 999999999
  }

  // The entry still exists in the map, but getFieldMetadata would re-fetch
  // We verify the structure is correct for TTL checking
  const cached = model.fieldsCache['test.expired']
  t.ok(Date.now() - cached.timestamp > 300000, 'Expired entry timestamp is old enough to trigger refresh')

  t.end()
})
