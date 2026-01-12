#!/usr/bin/env node

require('dotenv').config()
const { DBSQLClient } = require('@databricks/sql')

async function createWKTTable() {
  const client = new DBSQLClient()

  try {
    console.log('📝 Creating test geospatial table with WKT strings...\n')

    await client.connect({
      token: process.env.DATABRICKS_TOKEN,
      host: process.env.DATABRICKS_SERVER_HOSTNAME,
      path: process.env.DATABRICKS_HTTP_PATH
    })

    const session = await client.openSession()

    // Drop if exists
    console.log('Dropping existing table if exists...')
    const dropQuery = await session.executeStatement(
      `DROP TABLE IF EXISTS main.default.koop_test_cities`,
      { runAsync: true }
    )
    await dropQuery.fetchAll()
    await dropQuery.close()

    // Create table with WKT string
    console.log('Creating table main.default.koop_test_cities with WKT geometry...')
    const createQuery = await session.executeStatement(`
      CREATE TABLE main.default.koop_test_cities (
        objectid BIGINT,
        city_name STRING,
        population INT,
        state STRING,
        geometry_wkt STRING,
        srid INT
      ) USING DELTA
    `, { runAsync: true })
    await createQuery.fetchAll()
    await createQuery.close()

    // Insert test data with WKT
    console.log('Inserting test data...')
    const insertQuery = await session.executeStatement(`
      INSERT INTO main.default.koop_test_cities VALUES
        (1, 'San Francisco', 874961, 'California', 'POINT(-122.4194 37.7749)', 4326),
        (2, 'Los Angeles', 3979576, 'California', 'POINT(-118.2437 34.0522)', 4326),
        (3, 'New York', 8336817, 'New York', 'POINT(-74.0060 40.7128)', 4326),
        (4, 'Chicago', 2693976, 'Illinois', 'POINT(-87.6298 41.8781)', 4326),
        (5, 'Houston', 2320268, 'Texas', 'POINT(-95.3698 29.7604)', 4326),
        (6, 'Seattle', 753675, 'Washington', 'POINT(-122.3321 47.6062)', 4326),
        (7, 'Denver', 727211, 'Colorado', 'POINT(-104.9903 39.7392)', 4326),
        (8, 'Boston', 692600, 'Massachusetts', 'POINT(-71.0589 42.3601)', 4326),
        (9, 'Miami', 467963, 'Florida', 'POINT(-80.1918 25.7617)', 4326),
        (10, 'Portland', 654741, 'Oregon', 'POINT(-122.6765 45.5231)', 4326)
    `, { runAsync: true })
    await insertQuery.fetchAll()
    await insertQuery.close()

    console.log('✅ Table created successfully!')
    console.log('   Table: main.default.koop_test_cities')
    console.log('   Rows: 10 US cities')
    console.log('   Columns: objectid, city_name, population, state, geometry_wkt, srid\n')

    // Test ST functions on WKT strings
    console.log('🧪 Testing ST functions with WKT strings...')
    const testQuery = await session.executeStatement(`
      SELECT
        objectid,
        city_name,
        population,
        state,
        geometry_wkt,
        ST_AsGeoJSON(ST_GeomFromText(geometry_wkt, srid)) as geojson
      FROM main.default.koop_test_cities
      LIMIT 3
    `, { runAsync: true })
    const testResult = await testQuery.fetchAll()
    await testQuery.close()

    console.log('\nSample rows with ST_AsGeoJSON:')
    testResult.forEach(row => {
      console.log(`  ${row.objectid}. ${row.city_name}, ${row.state}`)
      console.log(`     Population: ${row.population.toLocaleString()}`)
      console.log(`     WKT: ${row.geometry_wkt}`)
      console.log(`     GeoJSON: ${row.geojson}`)
    })

    // Test spatial filtering
    console.log('\n🧪 Testing ST_Intersects for spatial filtering...')
    const bboxQuery = await session.executeStatement(`
      SELECT
        city_name,
        state,
        ST_AsGeoJSON(ST_GeomFromText(geometry_wkt, srid)) as geojson
      FROM main.default.koop_test_cities
      WHERE ST_Intersects(
        ST_GeomFromText(geometry_wkt, srid),
        ST_GeomFromText('POLYGON((-125 30, -115 30, -115 50, -125 50, -125 30))', 4326)
      )
    `, { runAsync: true })
    const bboxResult = await bboxQuery.fetchAll()
    await bboxQuery.close()

    console.log('\nCities in West Coast bbox (-125,30,-115,50):')
    bboxResult.forEach(row => {
      console.log(`  - ${row.city_name}, ${row.state}`)
    })

    await session.close()
    await client.close()

    console.log('\n✅ All ST functions working!')
    console.log('\n⚠️  NOTE: This Databricks environment uses WKT strings, not native GEOMETRY type')
    console.log('    We need to update the Koop provider to handle WKT strings with ST functions\n')

    console.log('\n' + '='.repeat(70))
    console.log('CONFIGURATION NEEDED:')
    console.log('='.repeat(70))
    console.log('Update config/default.json to:')
    console.log(JSON.stringify({
      objectId: 'objectid',
      geometryColumn: 'geometry_wkt',
      spatialReference: 4326,
      maxRows: 10000
    }, null, 2))

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

createWKTTable()
