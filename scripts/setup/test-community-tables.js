/**
 * Test accessing Community Edition tables through Koop provider logic
 */

const { DBSQLClient } = require('@databricks/sql');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME || 'your-workspace.cloud.databricks.com',
  path: process.env.DATABRICKS_HTTP_PATH || '/sql/1.0/warehouses/your-warehouse-id',
  token: process.env.DATABRICKS_TOKEN || 'your_databricks_token'
};

async function testTableAccess() {
  const client = new DBSQLClient();
  const connection = await client.connect({
    host: config.host,
    path: config.path,
    token: config.token
  });

  console.log('✅ Connected to Databricks Community Edition\n');

  try {
    const session = await connection.openSession();

    // Test different table name formats
    const tableFormats = [
      'workspace.geospatial.koop_test_cities',
      'geospatial.koop_test_cities',
      'samples.nyctaxi.trips'
    ];

    for (const tableName of tableFormats) {
      console.log(`📊 Testing: ${tableName}`);

      try {
        const stmt = await session.executeStatement(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 5`);
        const result = await stmt.fetchAll();
        await stmt.close();

        const count = result[0].count;
        console.log(`   ✅ Accessible! Row count: ${count}\n`);
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}\n`);
      }
    }

    // Test if we can query our geospatial tables
    console.log('🗺️  Testing geospatial.koop_test_cities with geometry:');
    try {
      const stmt = await session.executeStatement(`
        SELECT objectid, city_name, state, population, geometry_wkt
        FROM geospatial.koop_test_cities
        LIMIT 3
      `);
      const result = await stmt.fetchAll();
      await stmt.close();

      console.log(`   ✅ Retrieved ${result.length} rows:`);
      result.forEach(row => {
        console.log(`      ${row.city_name}, ${row.state} - ${row.geometry_wkt}`);
      });
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }

    await session.close();
    await connection.close();
    await client.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

testTableAccess()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
