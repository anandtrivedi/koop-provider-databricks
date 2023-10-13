/*
  model-test.js

  This file is optional, but is strongly recommended. It tests the `getData` function to ensure its translating
  correctly.
*/

const test = require('tape')
const Model = require('../src/model')
const model = new Model()

test('should properly fetch from the API and translate features', t => {
  model.getData({ params: { id: 'geoserverat.default.structures_national_gdb' } }, (err, geojson) => {
    t.error(err)
    t.equal(geojson.type, 'FeatureCollection', 'creates a feature collection object')
    t.ok(geojson.features, 'has features')

    const feature = geojson.features[0]
    t.equal(feature.type, 'Feature', 'has proper type')
    t.equal(feature.geometry.type, 'Point', 'returns point geometries')
    t.deepEqual(feature.geometry.coordinates, [-116.30138297783401, 33.67238838002538], 'translates geometry correctly')
    t.ok(feature.properties, 'creates attributes')
    t.equal(feature.properties.ZIPCODE, 'CA000638', 'extracts zip code property field correctly')
    t.end()
  })
})
