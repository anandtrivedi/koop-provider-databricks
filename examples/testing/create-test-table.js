#!/usr/bin/env node

require('dotenv').config()
const { DBSQLClient } = require('@databricks/sql')

async function createTestTable() {
  const client = new DBSQLClient()

  try {
    console.log('📝 Creating test geospatial table...\n')

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

    // Create table with geometry
    console.log('Creating table main.default.koop_test_cities...')
    const createQuery = await session.executeStatement(`
      CREATE TABLE main.default.koop_test_cities (
        objectid BIGINT,
        city_name STRING,
        population INT,
        state STRING,
        geometry GEOMETRY
      ) USING DELTA
    `, { runAsync: true })
    await createQuery.fetchAll()
    await createQuery.close()

    // Insert test data
    console.log('Inserting test data...')
    const insertQuery = await session.executeStatement(`
      INSERT INTO main.default.koop_test_cities VALUES
        (1, 'San Francisco', 874961, 'California', ST_GeomFromText('POINT(-122.4194 37.7749)', 4326)),
        (2, 'Los Angeles', 3979576, 'California', ST_GeomFromText('POINT(-118.2437 34.0522)', 4326)),
        (3, 'New York', 8336817, 'New York', ST_GeomFromText('POINT(-74.0060 40.7128)', 4326)),
        (4, 'Chicago', 2693976, 'Illinois', ST_GeomFromText('POINT(-87.6298 41.8781)', 4326)),
        (5, 'Houston', 2320268, 'Texas', ST_GeomFromText('POINT(-95.3698 29.7604)', 4326)),
        (6, 'Seattle', 753675, 'Washington', ST_GeomFromText('POINT(-122.3321 47.6062)', 4326)),
        (7, 'Denver', 727211, 'Colorado', ST_GeomFromText('POINT(-104.9903 39.7392)', 4326)),
        (8, 'Boston', 692600, 'Massachusetts', ST_GeomFromText('POINT(-71.0589 42.3601)', 4326)),
        (9, 'Miami', 467963, 'Florida', ST_GeomFromText('POINT(-80.1918 25.7617)', 4326)),
        (10, 'Portland', 654741, 'Oregon', ST_GeomFromText('POINT(-122.6765 45.5231)', 4326))
    `, { runAsync: true })
    await insertQuery.fetchAll()
    await insertQuery.close()

    console.log('✅ Table created successfully!')
    console.log('   Table: main.default.koop_test_cities')
    console.log('   Rows: 10 US cities')
    console.log('   Columns: objectid, city_name, population, state, geometry\n')

    // Verify with ST_AsGeoJSON
    console.log('🧪 Testing ST_AsGeoJSON on the table...')
    const testQuery = await session.executeStatement(`
      SELECT objectid, city_name, population, state, ST_AsGeoJSON(geometry) as geojson
      FROM main.default.koop_test_cities
      LIMIT 3
    `, { runAsync: true })
    const testResult = await testQuery.fetchAll()
    await testQuery.close()

    console.log('\nSample rows:')
    testResult.forEach(row => {
      console.log(`  ${row.objectid}. ${row.city_name}, ${row.state}`)
      console.log(`     Population: ${row.population.toLocaleString()}`)
      console.log(`     GeoJSON: ${row.geojson}`)
    })

    await session.close()
    await client.close()

    console.log('\n🎉 Ready to test the Koop provider!')
    console.log('\n' + '='.repeat(70))
    console.log('START THE KOOP SERVER:')
    console.log('='.repeat(70))
    console.log('  npm start')
    console.log('\n' + '='.repeat(70))
    console.log('TEST QUERIES:')
    console.log('='.repeat(70))
    console.log('\n1. Get all cities (basic query):')
    console.log('   curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query"\n')
    console.log('2. Get cities in California (WHERE filter):')
    console.log('   curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?where=state=\'California\'"\n')
    console.log('3. Get specific fields only (field selection):')
    console.log('   curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?outFields=city_name,population,state"\n')
    console.log('4. Get attributes without geometry (returnGeometry=false):')
    console.log('   curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?returnGeometry=false"\n')
    console.log('5. Get cities with pagination:')
    console.log('   curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?resultOffset=0&resultRecordCount=3"\n')
    console.log('6. Get cities sorted by population:')
    console.log('   curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?orderByFields=population DESC"\n')
    console.log('7. Get cities in bounding box (West Coast):')
    console.log('   curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?geometry=-125,30,-115,50"\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('permission') || error.message.includes('denied')) {
      console.error('\nYou may not have CREATE TABLE permissions on main.default.')
      console.error('Please ask your admin to grant permissions or use a different catalog/schema.')
    }
  }
}

createTestTable()
