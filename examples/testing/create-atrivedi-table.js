require('dotenv').config()
const { DBSQLClient } = require('@databricks/sql')

async function createTable() {
  const client = new DBSQLClient()
  await client.connect({
    token: process.env.DATABRICKS_TOKEN,
    host: process.env.DATABRICKS_SERVER_HOSTNAME,
    path: process.env.DATABRICKS_HTTP_PATH
  })
  
  const session = await client.openSession()
  
  console.log('Creating schema atrivedi.koop_test...')
  try {
    await (await session.executeStatement('CREATE SCHEMA IF NOT EXISTS atrivedi.koop_test', { runAsync: true })).fetchAll()
    console.log('✅ Schema created')
  } catch (e) {
    console.log('Schema already exists or created')
  }
  
  console.log('\nDropping table if exists...')
  await (await session.executeStatement('DROP TABLE IF EXISTS atrivedi.koop_test.cities', { runAsync: true })).fetchAll()
  
  console.log('Creating table atrivedi.koop_test.cities...')
  await (await session.executeStatement(`
    CREATE TABLE atrivedi.koop_test.cities (
      objectid BIGINT,
      city_name STRING,
      population INT,
      state STRING,
      geometry_wkt STRING,
      srid INT
    ) USING DELTA
  `, { runAsync: true })).fetchAll()
  
  console.log('Inserting test data...')
  await (await session.executeStatement(`
    INSERT INTO atrivedi.koop_test.cities VALUES
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
  `, { runAsync: true })).fetchAll()
  
  console.log('\n✅ Table created successfully!')
  console.log('   Table: atrivedi.koop_test.cities')
  console.log('   Rows: 10 US cities\n')
  
  console.log('🧪 Testing query with ST functions...')
  const result = await (await session.executeStatement(`
    SELECT city_name, ST_AsGeoJSON(ST_GeomFromText(geometry_wkt, srid)) as geojson
    FROM atrivedi.koop_test.cities LIMIT 2
  `, { runAsync: true })).fetchAll()
  
  result.forEach(row => console.log(`   ${row.city_name}: ${row.geojson}`))
  
  await session.close()
  await client.close()
  
  console.log('\n🎉 Ready to test Koop provider!')
  console.log('\nTest URL:')
  console.log('  curl "http://localhost:8080/databricks/rest/services/atrivedi.koop_test.cities/FeatureServer/0/query"')
}

createTable().catch(console.error)
