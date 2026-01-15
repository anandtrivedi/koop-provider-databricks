#!/usr/bin/env node

require('dotenv').config()
const { DBSQLClient } = require('@databricks/sql')

async function findGeoTables() {
  const client = new DBSQLClient()

  try {
    await client.connect({
      token: process.env.DATABRICKS_TOKEN,
      host: process.env.DATABRICKS_SERVER_HOSTNAME,
      path: process.env.DATABRICKS_HTTP_PATH
    })

    const session = await client.openSession()

    console.log('🗺️  Searching for geospatial demo tables...\n')

    // Check common geospatial catalogs/schemas
    const geoSearchPaths = [
      'samples.nyctaxi',
      'hive_metastore.default',
      'main.default'
    ]

    for (const path of geoSearchPaths) {
      try {
        const [catalog, schema] = path.split('.')
        console.log(`Searching ${catalog}.${schema}...`)

        const tablesQuery = await session.executeStatement(
          `SHOW TABLES IN ${catalog}.${schema}`,
          { runAsync: true }
        )
        const tables = await tablesQuery.fetchAll()
        await tablesQuery.close()

        for (const table of tables) {
          const tableName = table.tableName
          const fullName = `${catalog}.${schema}.${tableName}`

          try {
            // Get table columns
            const descQuery = await session.executeStatement(
              `DESCRIBE TABLE ${fullName}`,
              { runAsync: true }
            )
            const columns = await descQuery.fetchAll()
            await descQuery.close()

            // Check for geometry-related columns
            const geomCols = columns.filter(col =>
              col.data_type && (
                col.data_type.toLowerCase().includes('geometry') ||
                col.data_type.toLowerCase() === 'binary' ||
                (col.col_name && (
                  col.col_name.toLowerCase().includes('geom') ||
                  col.col_name.toLowerCase().includes('wkt') ||
                  col.col_name.toLowerCase() === 'shape' ||
                  col.col_name.toLowerCase().includes('location') ||
                  col.col_name.toLowerCase().includes('lat') ||
                  col.col_name.toLowerCase().includes('lon') ||
                  col.col_name.toLowerCase().includes('point')
                ))
              )
            )

            if (geomCols.length > 0) {
              console.log(`\n  ✨ Found: ${fullName}`)
              console.log(`     Columns:`)
              geomCols.forEach(col => {
                console.log(`       - ${col.col_name}: ${col.data_type}`)
              })

              // Try to get a sample row
              try {
                const sampleQuery = await session.executeStatement(
                  `SELECT * FROM ${fullName} LIMIT 1`,
                  { runAsync: true, maxRows: 1 }
                )
                const sample = await sampleQuery.fetchAll()
                await sampleQuery.close()

                if (sample.length > 0) {
                  console.log(`     Sample data available: ✅`)
                }
              } catch (err) {
                console.log(`     Sample data: ❌ ${err.message}`)
              }
            }
          } catch (err) {
            // Skip tables we can't access
          }
        }
      } catch (err) {
        console.log(`  ⚠️  Cannot access ${path}: ${err.message}`)
      }
    }

    // Try to create a test table with geometry
    console.log('\n📝 Creating test table with geometry...')
    try {
      // Drop if exists
      await session.executeStatement(
        `DROP TABLE IF EXISTS main.default.koop_test_cities`,
        { runAsync: true }
      )

      // Create table with geometry
      const createQuery = await session.executeStatement(`
        CREATE TABLE main.default.koop_test_cities (
          objectid BIGINT,
          city_name STRING,
          population INT,
          state STRING,
          geometry GEOMETRY
        ) USING DELTA
      `, { runAsync: true })
      await createQuery.close()

      // Insert test data
      const insertQuery = await session.executeStatement(`
        INSERT INTO main.default.koop_test_cities VALUES
          (1, 'San Francisco', 874961, 'California', ST_GeomFromText('POINT(-122.4194 37.7749)', 4326)),
          (2, 'Los Angeles', 3979576, 'California', ST_GeomFromText('POINT(-118.2437 34.0522)', 4326)),
          (3, 'New York', 8336817, 'New York', ST_GeomFromText('POINT(-74.0060 40.7128)', 4326)),
          (4, 'Chicago', 2693976, 'Illinois', ST_GeomFromText('POINT(-87.6298 41.8781)', 4326)),
          (5, 'Houston', 2320268, 'Texas', ST_GeomFromText('POINT(-95.3698 29.7604)', 4326))
      `, { runAsync: true })
      await insertQuery.close()

      console.log('✅ Created test table: main.default.koop_test_cities')
      console.log('   - 5 cities with geometry (POINT)')
      console.log('   - Columns: objectid, city_name, population, state, geometry')

      // Verify ST_AsGeoJSON works on the table
      const testQuery = await session.executeStatement(`
        SELECT city_name, ST_AsGeoJSON(geometry) as geojson
        FROM main.default.koop_test_cities
        LIMIT 1
      `, { runAsync: true })
      const testResult = await testQuery.fetchAll()
      await testQuery.close()

      if (testResult.length > 0) {
        console.log(`\n✅ ST_AsGeoJSON test:`)
        console.log(`   ${testResult[0].city_name}: ${testResult[0].geojson}`)
      }

      console.log('\n🎉 Ready to test!')
      console.log('\nStart the Koop server:')
      console.log('  npm start')
      console.log('\nTest queries:')
      console.log('  # Get all cities')
      console.log('  curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query"')
      console.log('\n  # Get cities in California')
      console.log('  curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?where=state=\'California\'"')
      console.log('\n  # Get only city names and population (no geometry)')
      console.log('  curl "http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query?outFields=city_name,population&returnGeometry=false"')

    } catch (err) {
      console.log(`❌ Error creating test table: ${err.message}`)
      console.log('   You may not have CREATE TABLE permissions on main.default')
    }

    await session.close()
    await client.close()

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

findGeoTables()
