#!/usr/bin/env node

require('dotenv').config()
const { DBSQLClient } = require('@databricks/sql')

async function testObjectIds() {
  const client = new DBSQLClient()
  try {
    await client.connect({
      token: process.env.DATABRICKS_TOKEN,
      host: process.env.DATABRICKS_SERVER_HOSTNAME,
      path: process.env.DATABRICKS_HTTP_PATH
    })

    const session = await client.openSession()

    // Query all objectids
    console.log('Testing direct query with ORDER BY and LIMIT/OFFSET:\n')

    for (let offset = 0; offset < 12; offset += 3) {
      const query = await session.executeStatement(
        `SELECT objectid, city_name FROM main.default.koop_test_cities ORDER BY objectid LIMIT 3 OFFSET ${offset}`,
        { runAsync: true }
      )
      const results = await query.fetchAll()
      await query.close()

      console.log(`Offset ${offset}: Found ${results.length} rows`)
      results.forEach(row => {
        console.log(`  - objectid=${row.objectid}, city=${row.city_name}`)
      })
      console.log('')
    }

    await session.close()
    await client.close()
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testObjectIds()
