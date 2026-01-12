const { DBSQLClient } = require('@databricks/sql');

const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME || 'your-workspace.cloud.databricks.com',
  path: process.env.DATABRICKS_HTTP_PATH || '/sql/1.0/warehouses/your-warehouse-id',
  token: process.env.DATABRICKS_TOKEN || 'your-databricks-token'
};

async function exploreTables() {
  const client = new DBSQLClient();

  try {
    const conn = await client.connect(config);
    const session = await conn.openSession();

    console.log('✅ Connected to Databricks');
    console.log('📊 Exploring pubsec_geo_law.demo schema...\n');

    // List all tables in the schema
    const tablesQuery = await session.executeStatement(
      'SHOW TABLES IN pubsec_geo_law.demo',
      { runAsync: true }
    );
    const tables = await tablesQuery.fetchAll();
    await tablesQuery.close();

    console.log(`Found ${tables.length} tables:\n`);

    // For each table, get its schema to find geometry columns
    for (const table of tables) {
      const tableName = table.tableName;
      console.log(`\n📋 Table: pubsec_geo_law.demo.${tableName}`);

      try {
        // Describe the table
        const descQuery = await session.executeStatement(
          `DESCRIBE pubsec_geo_law.demo.${tableName}`,
          { runAsync: true }
        );
        const columns = await descQuery.fetchAll();
        await descQuery.close();

        console.log('   Columns:');
        let hasGeometry = false;
        for (const col of columns) {
          const colName = col.col_name;
          const colType = col.data_type;
          console.log(`   - ${colName}: ${colType}`);

          if (colType && (colType.toLowerCase().includes('geometry') ||
                          colType.toLowerCase().includes('geo') ||
                          colName.toLowerCase().includes('wkt') ||
                          colName.toLowerCase().includes('geom'))) {
            hasGeometry = true;
          }
        }

        // Get row count
        const countQuery = await session.executeStatement(
          `SELECT COUNT(*) as cnt FROM pubsec_geo_law.demo.${tableName}`,
          { runAsync: true }
        );
        const countResult = await countQuery.fetchAll();
        await countQuery.close();

        console.log(`   📊 Row count: ${countResult[0].cnt}`);
        console.log(`   ${hasGeometry ? '✅ Has geometry columns' : '❌ No obvious geometry columns'}`);

        // Sample a few rows if it's small
        if (countResult[0].cnt > 0 && countResult[0].cnt < 100) {
          const sampleQuery = await session.executeStatement(
            `SELECT * FROM pubsec_geo_law.demo.${tableName} LIMIT 3`,
            { runAsync: true }
          );
          const sample = await sampleQuery.fetchAll();
          await sampleQuery.close();

          if (sample.length > 0) {
            console.log(`   Sample row keys: ${Object.keys(sample[0]).join(', ')}`);
          }
        }

      } catch (err) {
        console.log(`   ⚠️ Error describing table: ${err.message}`);
      }
    }

    await session.close();
    await conn.close();

    console.log('\n✅ Exploration complete');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

exploreTables();
