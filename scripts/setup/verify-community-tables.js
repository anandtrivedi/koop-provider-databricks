/**
 * Verify Tables Exist in Community Edition
 */

const { DBSQLClient } = require('@databricks/sql');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME || 'your-workspace.cloud.databricks.com',
  path: process.env.DATABRICKS_HTTP_PATH || '/sql/1.0/warehouses/your-warehouse-id',
  token: process.env.DATABRICKS_TOKEN || 'your_databricks_token'
};

async function verifyTables() {
  const client = new DBSQLClient();
  const connection = await client.connect({
    host: config.host,
    path: config.path,
    token: config.token
  });

  console.log('✅ Connected to Databricks Community Edition\n');

  try {
    const session = await connection.openSession();

    // Check what tables exist in geospatial schema
    console.log('📋 Checking tables in geospatial schema...\n');

    const showTablesStmt = await session.executeStatement('SHOW TABLES IN geospatial');
    const showTablesResult = await showTablesStmt.fetchAll();
    await showTablesStmt.close();

    if (showTablesResult.length === 0) {
      console.log('❌ No tables found in geospatial schema!\n');
      console.log('Tables may have been created in default schema instead.');
      console.log('Let me check default schema...\n');

      const defaultTablesStmt = await session.executeStatement('SHOW TABLES IN default');
      const defaultTablesResult = await defaultTablesStmt.fetchAll();
      await defaultTablesStmt.close();

      console.log(`Found ${defaultTablesResult.length} tables in default schema:`);
      defaultTablesResult.forEach(row => {
        console.log(`   - ${row.database}.${row.tableName}`);
      });
    } else {
      console.log(`✅ Found ${showTablesResult.length} tables in geospatial schema:\n`);

      for (const row of showTablesResult) {
        console.log(`📊 Table: geospatial.${row.tableName}`);

        // Count rows in each table
        try {
          const countStmt = await session.executeStatement(`SELECT COUNT(*) as count FROM geospatial.${row.tableName}`);
          const countResult = await countStmt.fetchAll();
          await countStmt.close();

          const rowCount = countResult[0].count;
          console.log(`   Rows: ${rowCount}`);

          // Show sample data
          const sampleStmt = await session.executeStatement(`SELECT * FROM geospatial.${row.tableName} LIMIT 2`);
          const sampleResult = await sampleStmt.fetchAll();
          await sampleStmt.close();

          if (sampleResult.length > 0) {
            console.log('   Sample data:');
            sampleResult.forEach((row, idx) => {
              console.log(`     Row ${idx + 1}:`, JSON.stringify(row, null, 2));
            });
          }
          console.log('');
        } catch (e) {
          console.log(`   ⚠️  Could not query table: ${e.message}\n`);
        }
      }
    }

    await session.close();
    await connection.close();
    await client.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

verifyTables()
  .then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
