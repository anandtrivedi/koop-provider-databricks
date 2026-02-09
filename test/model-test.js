/*
  model-test.js

  This file is optional, but is strongly recommended. It tests the `getData` function to ensure its translating
  correctly.

  Note: This is an integration test that requires a live Databricks connection.
  It will skip gracefully when DATABRICKS_SERVER_HOSTNAME is not set.
*/

const test = require('tape')

test('should properly fetch from the API and translate features', t => {
  if (!process.env.DATABRICKS_SERVER_HOSTNAME) {
    t.skip('Skipping integration test - no Databricks connection configured')
    t.end()
    return
  }

  const Model = require('../src/model')
  const model = new Model()

  model.getData({
    params: { id: 'geoserverat.default.structures_national_gdb' },
    query: {},
    url: '/test'
  }, (err, geojson) => {
    t.error(err)
    if (err) {
      t.end()
      return
    }
    t.equal(geojson.type, 'FeatureCollection', 'creates a feature collection object')
    t.ok(geojson.features, 'has features')

    const feature = geojson.features[0]
    t.equal(feature.type, 'Feature', 'has proper type')
    t.equal(feature.geometry.type, 'Point', 'returns point geometries')
    t.deepEqual(feature.geometry.coordinates, [-116.30138297783401, 33.67238838002538], 'translates geometry correctly')
    t.ok(feature.properties, 'creates attributes')
    t.equal(feature.properties.ZIPCODE, '92253', 'extracts zip code property field correctly')
    t.end()
  })
})
