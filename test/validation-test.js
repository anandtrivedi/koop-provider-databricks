/*
  validation-test.js

  Tests for input validation and query building
*/

const test = require('tape')

// Basic tests to ensure the module structure is working
// More comprehensive tests would require a test Databricks environment

test('model module loads correctly', t => {
  t.plan(2)

  const Model = require('../src/model')
  const model = new Model()

  t.ok(Model, 'Model class exists')
  t.ok(model.getData, 'getData method exists')
  t.end()
})

test('model validation - invalid table name', t => {
  t.plan(1)

  const Model = require('../src/model')
  const model = new Model()

  // Test with invalid table name (missing dots)
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

test('model validation - missing credentials', t => {
  t.plan(1)

  // Temporarily clear environment variables
  const savedToken = process.env.DATABRICKS_TOKEN
  const savedHost = process.env.DATABRICKS_SERVER_HOSTNAME
  const savedPath = process.env.DATABRICKS_HTTP_PATH

  delete process.env.DATABRICKS_TOKEN
  delete process.env.DATABRICKS_SERVER_HOSTNAME
  delete process.env.DATABRICKS_HTTP_PATH

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

    t.end()
  })
})
