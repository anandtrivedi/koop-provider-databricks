#!/usr/bin/env node

require('dotenv').config()
const { DBSQLClient } = require('@databricks/sql')

// US States with approximate center coordinates and bbox
const US_STATES = [
  { name: 'California', abbr: 'CA', lat: 36.7783, lon: -119.4179, minLat: 32.5, maxLat: 42, minLon: -124.4, maxLon: -114.1 },
  { name: 'Texas', abbr: 'TX', lat: 31.9686, lon: -99.9018, minLat: 25.8, maxLat: 36.5, minLon: -106.6, maxLon: -93.5 },
  { name: 'Florida', abbr: 'FL', lat: 27.9944, lon: -81.7603, minLat: 24.5, maxLat: 31, minLon: -87.6, maxLon: -80 },
  { name: 'New York', abbr: 'NY', lat: 43.2994, lon: -74.2179, minLat: 40.5, maxLat: 45, minLon: -79.8, maxLon: -71.9 },
  { name: 'Pennsylvania', abbr: 'PA', lat: 41.2033, lon: -77.1945, minLat: 39.7, maxLat: 42, minLon: -80.5, maxLon: -74.7 },
  { name: 'Illinois', abbr: 'IL', lat: 40.6331, lon: -89.3985, minLat: 37, maxLat: 42.5, minLon: -91.5, maxLon: -87.5 },
  { name: 'Ohio', abbr: 'OH', lat: 40.4173, lon: -82.9071, minLat: 38.4, maxLat: 42, minLon: -84.8, maxLon: -80.5 },
  { name: 'Georgia', abbr: 'GA', lat: 32.1656, lon: -82.9001, minLat: 30.4, maxLat: 35, minLon: -85.6, maxLon: -80.8 },
  { name: 'North Carolina', abbr: 'NC', lat: 35.7596, lon: -79.0193, minLat: 33.8, maxLat: 36.6, minLon: -84.3, maxLon: -75.5 },
  { name: 'Michigan', abbr: 'MI', lat: 44.3148, lon: -85.6024, minLat: 41.7, maxLat: 48.3, minLon: -90.4, maxLon: -82.4 },
  { name: 'New Jersey', abbr: 'NJ', lat: 40.0583, lon: -74.4057, minLat: 38.9, maxLat: 41.4, minLon: -75.6, maxLon: -73.9 },
  { name: 'Virginia', abbr: 'VA', lat: 37.4316, lon: -78.6569, minLat: 36.5, maxLat: 39.5, minLon: -83.7, maxLon: -75.2 },
  { name: 'Washington', abbr: 'WA', lat: 47.7511, lon: -120.7401, minLat: 45.5, maxLat: 49, minLon: -124.8, maxLon: -116.9 },
  { name: 'Arizona', abbr: 'AZ', lat: 34.0489, lon: -111.0937, minLat: 31.3, maxLat: 37, minLon: -114.8, maxLon: -109 },
  { name: 'Massachusetts', abbr: 'MA', lat: 42.4072, lon: -71.3824, minLat: 41.2, maxLat: 42.9, minLon: -73.5, maxLon: -69.9 },
  { name: 'Tennessee', abbr: 'TN', lat: 35.5175, lon: -86.5804, minLat: 35, maxLat: 36.7, minLon: -90.3, maxLon: -81.6 },
  { name: 'Indiana', abbr: 'IN', lat: 40.2672, lon: -86.1349, minLat: 37.8, maxLat: 41.8, minLon: -88.1, maxLon: -84.8 },
  { name: 'Missouri', abbr: 'MO', lat: 37.9643, lon: -91.8318, minLat: 36, maxLat: 40.6, minLon: -95.8, maxLon: -89.1 },
  { name: 'Maryland', abbr: 'MD', lat: 39.0458, lon: -76.6413, minLat: 37.9, maxLat: 39.7, minLon: -79.5, maxLon: -75 },
  { name: 'Wisconsin', abbr: 'WI', lat: 43.7844, lon: -88.7879, minLat: 42.5, maxLat: 47, minLon: -92.9, maxLon: -86.8 },
  { name: 'Colorado', abbr: 'CO', lat: 39.5501, lon: -105.7821, minLat: 37, maxLat: 41, minLon: -109, maxLon: -102 },
  { name: 'Minnesota', abbr: 'MN', lat: 46.7296, lon: -94.6859, minLat: 43.5, maxLat: 49.4, minLon: -97.2, maxLon: -89.5 },
  { name: 'South Carolina', abbr: 'SC', lat: 33.8361, lon: -81.1637, minLat: 32.0, maxLat: 35.2, minLon: -83.4, maxLon: -78.5 },
  { name: 'Alabama', abbr: 'AL', lat: 32.3182, lon: -86.9023, minLat: 30.2, maxLat: 35, minLon: -88.5, maxLon: -84.9 },
  { name: 'Louisiana', abbr: 'LA', lat: 30.9843, lon: -91.9623, minLat: 28.9, maxLat: 33, minLon: -94.0, maxLon: -88.8 }
]

const PLACE_TYPES = ['City', 'Town', 'Village', 'Borough', 'Township']
const PREFIXES = ['North', 'South', 'East', 'West', 'New', 'Old', 'Upper', 'Lower', 'Mount', 'Lake', 'Port']
const BASE_NAMES = ['Springfield', 'Franklin', 'Clinton', 'Madison', 'Washington', 'Arlington', 'Georgetown', 'Bristol',
  'Chester', 'Manchester', 'Salem', 'Windsor', 'Auburn', 'Fairfield', 'Riverside', 'Oakland', 'Clayton', 'Milton',
  'Clifton', 'Hudson', 'Marion', 'Jackson', 'Lincoln', 'Monroe', 'Hamilton', 'Jefferson', 'Lexington', 'Greenville']

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min, max, decimals = 4) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function generatePlaceName() {
  const usePrefix = Math.random() > 0.6
  const base = BASE_NAMES[randomInt(0, BASE_NAMES.length - 1)]
  const type = PLACE_TYPES[randomInt(0, PLACE_TYPES.length - 1)]

  if (usePrefix) {
    const prefix = PREFIXES[randomInt(0, PREFIXES.length - 1)]
    return `${prefix} ${base}`
  }
  return base
}

function generateRecord(id, state) {
  const lat = randomFloat(state.minLat, state.maxLat)
  const lon = randomFloat(state.minLon, state.maxLon)
  const population = randomInt(500, 500000)
  const name = generatePlaceName()

  return {
    objectid: id,
    place_name: name,
    population: population,
    state: state.name,
    state_abbr: state.abbr,
    latitude: lat,
    longitude: lon,
    geometry_wkt: `POINT(${lon} ${lat})`,
    srid: 4326
  }
}

async function createLargeTestDataset() {
  const client = new DBSQLClient()
  const TOTAL_RECORDS = 5000
  const BATCH_SIZE = 500

  try {
    console.log(`\n🚀 Creating large test dataset with ${TOTAL_RECORDS} records...\n`)

    await client.connect({
      token: process.env.DATABRICKS_TOKEN,
      host: process.env.DATABRICKS_SERVER_HOSTNAME,
      path: process.env.DATABRICKS_HTTP_PATH
    })

    const session = await client.openSession()

    // Drop existing table
    console.log('Dropping existing table if exists...')
    const dropQuery = await session.executeStatement(
      `DROP TABLE IF EXISTS main.default.koop_large_test`,
      { runAsync: true }
    )
    await dropQuery.fetchAll()
    await dropQuery.close()

    // Create table
    console.log('Creating table main.default.koop_large_test...')
    const createQuery = await session.executeStatement(`
      CREATE TABLE main.default.koop_large_test (
        objectid BIGINT,
        place_name STRING,
        population INT,
        state STRING,
        state_abbr STRING,
        latitude DOUBLE,
        longitude DOUBLE,
        geometry_wkt STRING,
        srid INT
      ) USING DELTA
    `, { runAsync: true })
    await createQuery.fetchAll()
    await createQuery.close()

    // Generate and insert records in batches
    console.log(`\nGenerating and inserting ${TOTAL_RECORDS} records in batches of ${BATCH_SIZE}...`)

    for (let batch = 0; batch < Math.ceil(TOTAL_RECORDS / BATCH_SIZE); batch++) {
      const startId = batch * BATCH_SIZE + 1
      const endId = Math.min((batch + 1) * BATCH_SIZE, TOTAL_RECORDS)
      const batchRecords = []

      // Generate records for this batch
      for (let id = startId; id <= endId; id++) {
        const state = US_STATES[id % US_STATES.length]
        const record = generateRecord(id, state)
        batchRecords.push(record)
      }

      // Build INSERT statement
      const values = batchRecords.map(r =>
        `(${r.objectid}, '${r.place_name.replace(/'/g, "''")}', ${r.population}, '${r.state}', ` +
        `'${r.state_abbr}', ${r.latitude}, ${r.longitude}, '${r.geometry_wkt}', ${r.srid})`
      ).join(',\n        ')

      const insertSQL = `INSERT INTO main.default.koop_large_test VALUES\n        ${values}`

      console.log(`  Batch ${batch + 1}/${Math.ceil(TOTAL_RECORDS / BATCH_SIZE)}: Inserting records ${startId}-${endId}...`)

      const insertQuery = await session.executeStatement(insertSQL, { runAsync: true })
      await insertQuery.fetchAll()
      await insertQuery.close()
    }

    console.log(`\n✅ Successfully created ${TOTAL_RECORDS} records!\n`)

    // Verify record count
    console.log('Verifying record count...')
    const countQuery = await session.executeStatement(
      `SELECT COUNT(*) as cnt FROM main.default.koop_large_test`,
      { runAsync: true }
    )
    const countResult = await countQuery.fetchAll()
    await countQuery.close()
    console.log(`   Total records: ${countResult[0].cnt}\n`)

    // Get sample statistics
    console.log('Sample statistics:')
    const statsQuery = await session.executeStatement(`
      SELECT
        state,
        COUNT(*) as record_count,
        MIN(population) as min_pop,
        MAX(population) as max_pop,
        AVG(population) as avg_pop
      FROM main.default.koop_large_test
      GROUP BY state
      ORDER BY record_count DESC
      LIMIT 5
    `, { runAsync: true })
    const statsResult = await statsQuery.fetchAll()
    await statsQuery.close()

    console.log('\nTop 5 states by record count:')
    statsResult.forEach(row => {
      console.log(`  ${row.state}: ${row.record_count} records, ` +
        `pop range ${row.min_pop.toLocaleString()}-${row.max_pop.toLocaleString()}, ` +
        `avg ${Math.round(row.avg_pop).toLocaleString()}`)
    })

    await session.close()
    await client.close()

    console.log('\n' + '='.repeat(70))
    console.log('PERFORMANCE TESTING')
    console.log('='.repeat(70))
    console.log('\n1. Start the Koop server:')
    console.log('   npm start\n')
    console.log('2. Run performance tests:')
    console.log('   node test-performance.js\n')
    console.log('3. Test URL:')
    console.log('   http://localhost:8080/databricks/rest/services/main.default.koop_large_test/FeatureServer/0\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

createLargeTestDataset()
