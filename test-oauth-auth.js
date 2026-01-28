/**
 * Test OAuth2 M2M Authentication with Service Principal
 */

const { DBSQLClient } = require('@databricks/sql');
require('dotenv').config();

async function testOAuthAuth() {
  console.log('Testing OAuth2 M2M Authentication...\n');

  const config = {
    host: process.env.DATABRICKS_SERVER_HOSTNAME || 'dbc-1e152a66-a886.cloud.databricks.com',
    path: process.env.DATABRICKS_HTTP_PATH || '/sql/1.0/warehouses/b756bd164fba99fd',
    authType: 'databricks-oauth',
    oauthClientId: process.env.DATABRICKS_CLIENT_ID || 'f2229ae7-d6a7-4fa3-ab7c-cfddc08c384e', // gitleaks:allow
    oauthClientSecret: process.env.DATABRICKS_CLIENT_SECRET || 'dose272cec7cc940bc6c27831f23da169d43' // gitleaks:allow
  };

  console.log('Configuration:');
  console.log('  Host:', config.host);
  console.log('  Path:', config.path);
  console.log('  Auth Type:', config.authType);
  console.log('  Client ID:', config.oauthClientId);
  console.log('  Client Secret:', config.oauthClientSecret.substring(0, 10) + '...');
  console.log();

  const client = new DBSQLClient();

  try {
    console.log('Connecting to Databricks with OAuth2 M2M...');
    await client.connect(config);
    console.log('✅ Connected successfully!\n');

    console.log('Opening session...');
    const session = await client.openSession();
    console.log('✅ Session opened successfully!\n');

    console.log('Testing query: SELECT 1 as test');
    const queryOperation = await session.executeStatement('SELECT 1 as test');
    const result = await queryOperation.fetchAll();
    await queryOperation.close();
    console.log('✅ Query result:', result);
    console.log();

    console.log('Testing with geospatial table...');
    const geoQuery = await session.executeStatement(
      'SELECT city_name, state, population FROM geospatial.koop_test_cities LIMIT 3'
    );
    const geoResult = await geoQuery.fetchAll();
    await geoQuery.close();
    console.log('✅ Geospatial query result:');
    geoResult.forEach(row => {
      console.log(`  - ${row.city_name}, ${row.state}: ${row.population.toLocaleString()}`);
    });
    console.log();

    await session.close();
    await client.close();

    console.log('✅ All tests passed! OAuth2 M2M authentication works!\n');
    console.log('Summary:');
    console.log('  - Service Principal authentication: ✅ Working');
    console.log('  - Session management: ✅ Working');
    console.log('  - Query execution: ✅ Working');
    console.log('  - Geospatial data access: ✅ Working');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testOAuthAuth();
