#!/usr/bin/env node

/*
  Test script to connect to Databricks and discover tables with geometry data
*/

require('dotenv').config()
const { DBSQLClient } = require('@databricks/sql')

async function testConnection() {
  const token = process.env.DATABRICKS_TOKEN
  const serverHostname = process.env.DATABRICKS_SERVER_HOSTNAME
  const httpPath = process.env.DATABRICKS_HTTP_PATH

  console.log('🔌 Testing Databricks Connection...')
  console.log(`Host: ${serverHostname}`)
  console.log(`Path: ${httpPath}`)
  console.log('')

  const client = new DBSQLClient()

  try {
    console.log('Connecting to Databricks...')
    await client.connect({
      token: token,
      host: serverHostname,
      path: httpPath
    })
    console.log('✅ Connection successful!\n')

    const session = await client.openSession()

    // List available catalogs
    console.log('📚 Available Catalogs:')
    const catalogQuery = await session.executeStatement('SHOW CATALOGS', { runAsync: true })
    const catalogs = await catalogQuery.fetchAll()
    await catalogQuery.close()

    catalogs.forEach(cat => {
      console.log(`  - ${cat.catalog || cat.namespace}`)
    })
    console.log('')

    // Try to find tables with geometry columns
    console.log('🗺️  Searching for tables with geometry columns...\n')

    // Try common catalog/schema combinations
    const searchPaths = [
      'main.default',
      'samples.nyctaxi',
      'samples.tpch',
      'hive_metastore.default'
    ]

    for (const path of searchPaths) {
      try {
        const [catalog, schema] = path.split('.')
        console.log(`Checking ${catalog}.${schema}...`)

        const tablesQuery = await session.executeStatement(
          `SHOW TABLES IN ${catalog}.${schema}`,
          { runAsync: true }
        )
        const tables = await tablesQuery.fetchAll()
        await tablesQuery.close()

        if (tables.length > 0) {
          console.log(`  Found ${tables.length} tables:`)

          for (const table of tables.slice(0, 5)) { // Check first 5 tables
            const tableName = table.tableName
            const fullName = `${catalog}.${schema}.${tableName}`

            try {
              // Check table schema for geometry columns
              const descQuery = await session.executeStatement(
                `DESCRIBE TABLE ${fullName}`,
                { runAsync: true }
              )
              const columns = await descQuery.fetchAll()
              await descQuery.close()

              const geomColumns = columns.filter(col =>
                col.data_type && (
                  col.data_type.toLowerCase().includes('geometry') ||
                  col.col_name.toLowerCase().includes('geom') ||
                  col.col_name.toLowerCase().includes('wkt') ||
                  col.col_name.toLowerCase().includes('location') ||
                  col.col_name.toLowerCase().includes('shape')
                )
              )

              if (geomColumns.length > 0) {
                console.log(`    ✨ ${fullName}`)
                geomColumns.forEach(col => {
                  console.log(`       - ${col.col_name}: ${col.data_type}`)
                })
              }
            } catch (err) {
              // Table might not be accessible, skip
            }
          }
        }
        console.log('')
      } catch (err) {
        console.log(`  ⚠️  Cannot access ${path}`)
      }
    }

    // Try to run a simple query to test ST functions
    console.log('🧪 Testing ST functions support...')
    try {
      const testQuery = await session.executeStatement(
        `SELECT ST_GeomFromText('POINT(-122.4194 37.7749)', 4326) as geom`,
        { runAsync: true }
      )
      const result = await testQuery.fetchAll()
      await testQuery.close()

      if (result.length > 0) {
        console.log('✅ ST_GeomFromText works!')

        // Test ST_AsGeoJSON
        const jsonQuery = await session.executeStatement(
          `SELECT ST_AsGeoJSON(ST_GeomFromText('POINT(-122.4194 37.7749)', 4326)) as geojson`,
          { runAsync: true }
        )
        const jsonResult = await jsonQuery.fetchAll()
        await jsonQuery.close()

        if (jsonResult.length > 0 && jsonResult[0].geojson) {
          console.log('✅ ST_AsGeoJSON works!')
          console.log(`   Result: ${jsonResult[0].geojson}`)
        }
      }
    } catch (err) {
      console.log('❌ ST functions might not be available')
      console.log(`   Error: ${err.message}`)
    }
    console.log('')

    await session.close()
    await client.close()

    console.log('✅ Test completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Identify a table with geometry data from the list above')
    console.log('2. Update config/default.json with your geometry column name')
    console.log('3. Start the server: npm start')
    console.log('4. Test query: curl http://localhost:8080/databricks/rest/services/catalog.schema.table/FeatureServer/0/query')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

testConnection()
