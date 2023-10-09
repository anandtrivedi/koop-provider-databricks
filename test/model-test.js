/*
  model-test.js

  This file is optional, but is strongly recommended. It tests the `getData` function to ensure its translating
  correctly.
*/

const test = require('tape')
const Model = require('../src/model')
const model = new Model()

test('should properly fetch from the API and translate features', t => {
  model.getData({ params: { id: 'stuart.geospatial.oproad_motorway_junctions' } }, (err, geojson) => {
    t.error(err)
    t.equal(geojson.type, 'FeatureCollection', 'creates a feature collection object')
    t.ok(geojson.features, 'has features')

    const feature = geojson.features[0]
    t.equal(feature.type, 'Feature', 'has proper type')
    t.equal(feature.geometry.type, 'Point', 'returns point geometries')
    t.deepEqual(feature.geometry.coordinates, [-2.6492791853702613, 54.50751433669944], 'translates geometry correctly')
    t.ok(feature.properties, 'creates attributes')
    t.equal(feature.properties.junction_number, 'M6 J39', 'extracts junction_number property field correctly')
    t.end()
  })
})
