/*
  model-test.js

  This file is optional, but is strongly recommended. It tests the `getData` function to ensure its translating
  correctly.
*/

const test = require('tape')
const Model = require('../src/model')
const model = new Model()

test('should properly fetch from the API and translate features', t => {
  model.getData({ params: { id: 'stuart.bp_geo_perf.test_geometries' } }, (err, geojson) => {
    t.error(err)
    t.equal(geojson.type, 'FeatureCollection', 'creates a feature collection object')
    t.ok(geojson.features, 'has features')

    const feature = geojson.features[0]
    t.equal(feature.type, 'Feature', 'has proper type')
    t.equal(feature.geometry.type, 'MultiPolygon', 'creates multi-polygon geometry')
    t.deepEqual(feature.geometry.coordinates[0][0][0], [-74.18445299999996, 40.694995999999904], 'translates geometry correctly')
    t.ok(feature.properties, 'creates attributes')
    t.equal(feature.properties.zone, 'Newark Airport', 'extracts zone property field correctly')
    t.end()
  })
})
