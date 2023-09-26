/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/usage/provider
*/
// const request = require('request').defaults({ gzip: true, json: true })
const { DBSQLClient } = require('@databricks/sql')

// const config = require('config')

function Model (koop) {}

// Public function to return data from a Databricks SQL Endpoint
// Return: GeoJSON FeatureCollection
//
// req.
//
// URL path parameters:
// req.params.id
// req.params.layer - not used, leave as '0'
// req.params.method - should be 'query'
Model.prototype.getData = function (req, callback) {

  const token = process.env.DATABRICKS_TOKEN
  const serverHostname = process.env.DATABRICKS_SERVER_HOSTNAME
  const httpPath = process.env.DATABRICKS_HTTP_PATH

  if (!token || !serverHostname || !httpPath) {
    throw new Error('Cannot find Server Hostname, HTTP Path, or personal access token. ' +
      'Check the environment variables DATABRICKS_TOKEN, ' +
      'DATABRICKS_SERVER_HOSTNAME, and DATABRICKS_HTTP_PATH.')
  }

  const client = new DBSQLClient()
  const connectOptions = {
    token: token,
    host: serverHostname,
    path: httpPath
  }

  // client.connect(connectOptions)
  //   .then(async client => {
  //     const session = await client.openSession();
  //
  //     const queryOperation = await session.executeStatement(
  //       `SELECT * FROM ${req.params.id}`,
  //       {
  //         runAsync: true,
  //         maxRows: 10 // This option enables the direct results feature.
  //       }
  //     );
  //
  //     const result = await queryOperation.fetchAll();
  //
  //     await queryOperation.close();
  //
  //     // hand off the data to Koop
  //     const geojson = translate(result)
  //     callback(null, geojson)
  //
  //     await session.close();
  //     await client.close();
  //   })
  //   .catch((error) => {
  //     console.log(error);
  //   })

  let geojson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [102.0, 0.5]
      },
      properties: {
        displayId: 0
      }
    }
      // }, {
      //   'type': 'Feature',
      //   'geometry': {
      //     'type': 'LineString',
      //     'coordinates': [
      //       [102.0, 0.0],
      //       [103.0, 1.0],
      //       [104.0, 0.0],
      //       [105.0, 1.0]
      //     ]
      //   },
      //   'properties': {
      //     'prop0': 'value0',
      //     'prop1': 0.0,
      //     'displayId': 1
      //   }
      // }, {
      //   'type': 'Feature',
      //   'geometry': {
      //     'type': 'Polygon',
      //     'coordinates': [
      //       [
      //         [100.0, 0.0],
      //         [101.0, 0.0],
      //         [101.0, 1.0],
      //         [100.0, 1.0],
      //         [100.0, 0.0]
      //       ]
      //     ]
      //   },
      //   'properties': {
      //     'prop0': 'value0',
      //     'prop1': {
      //       'this': 'that'
      //     },
      //     'displayId': 2
      //   }
      // }
    ],
    // "metadata": {
    //   "geometryType": "Point",
    //   "idField": "displayId",
    // "fields": [
    //   {
    //     "name": "displayId",
    //     "type": "Integer"
    //   }
    // ]
  // }
}
  geojson.metadata = geojson.metadata || {}
  geojson.metadata.idField = "displayId"
  callback(null, geojson)

}

function translate (input) {
  return {
    type: 'FeatureCollection',
    features: input.map(formatFeature)
  }
}

function formatFeature (inputFeature) {
  parser = require('wellknown')
  const parsed = parser.parse(inputFeature.the_geom)
  delete inputFeature.the_geom
  return {
    type: 'Feature',
    geometry: parsed,
    properties: inputFeature
  }
}

module.exports = Model