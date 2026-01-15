/**
 * Create Large Test Dataset for Pagination Testing
 *
 * This script creates a table with 10,000 synthetic point records
 * to demonstrate the provider's ability to handle large datasets
 * and proper pagination.
 *
 * The data represents synthetic business locations across the US.
 */

const { DBSQLClient } = require('@databricks/sql');

// Connection config from environment
const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME,
  path: process.env.DATABRICKS_HTTP_PATH,
  token: process.env.DATABRICKS_TOKEN
};

// Generate synthetic data
function generateLargeDataset(count) {
  const businesses = ['Store', 'Restaurant', 'Office', 'Warehouse', 'Shop', 'Cafe', 'Market', 'Mall', 'Center', 'Plaza'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA'];

  const records = [];

  for (let i = 1; i <= count; i++) {
    const businessType = businesses[Math.floor(Math.random() * businesses.length)];
    const cityIndex = Math.floor(Math.random() * cities.length);
    const city = cities[cityIndex];
    const state = states[cityIndex];

    // Generate random coordinates within US bounds
    // Longitude: -125 to -66 (West to East)
    // Latitude: 24 to 49 (South to North)
    const lon = -125 + Math.random() * 59;
    const lat = 24 + Math.random() * 25;

    // Random revenue between $50K and $5M
    const revenue = Math.floor(50000 + Math.random() * 4950000);

    // Random employee count between 1 and 500
    const employees = Math.floor(1 + Math.random() * 500);

    records.push({
      id: i,
      name: `${businessType} ${i}`,
      city: city,
      state: state,
      revenue: revenue,
      employees: employees,
      lon: lon.toFixed(6),
      lat: lat.toFixed(6)
    });
  }

  return records;
}

async function createLargeDataset() {
  const RECORD_COUNT = 10000;
  const BATCH_SIZE = 100;

  const client = new DBSQLClient();
  const connection = await client.connect({
    host: config.host,
    path: config.path,
    token: config.token
  });

  console.log('✅ Connected to Databricks\n');

  try {
    const session = await connection.openSession();

    // 1. DROP existing table
    console.log('🗑️  Dropping existing table...');
    try {
      await session.executeStatement('DROP TABLE IF EXISTS main.default.koop_large_dataset');
      console.log('   Dropped main.default.koop_large_dataset\n');
    } catch (e) {
      console.log('   Table doesn\'t exist, skipping\n');
    }

    // 2. CREATE TABLE
    console.log('📊 Creating koop_large_dataset table...');
    await session.executeStatement(`
      CREATE TABLE main.default.koop_large_dataset (
        objectid INT,
        business_name STRING,
        city STRING,
        state STRING,
        annual_revenue BIGINT,
        employee_count INT,
        geometry_wkt STRING
      )
    `);
    console.log('   ✅ Table created\n');

    // 3. GENERATE DATA
    console.log(`🎲 Generating ${RECORD_COUNT.toLocaleString()} synthetic records...`);
    const records = generateLargeDataset(RECORD_COUNT);
    console.log('   ✅ Data generated\n');

    // 4. INSERT DATA IN BATCHES
    console.log(`💾 Inserting data in batches of ${BATCH_SIZE}...`);
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, records.length);
      const batchRecords = records.slice(start, end);

      const values = batchRecords.map(r =>
        `(${r.id}, '${r.name}', '${r.city}', '${r.state}', ${r.revenue}, ${r.employees}, 'POINT(${r.lon} ${r.lat})')`
      ).join(',\n        ');

      await session.executeStatement(`
        INSERT INTO main.default.koop_large_dataset VALUES
        ${values}
      `);

      const progress = Math.round(((batch + 1) / totalBatches) * 100);
      process.stdout.write(`   Progress: ${progress}% (${end.toLocaleString()} / ${records.length.toLocaleString()} records)\r`);
    }

    console.log(`\n   ✅ Inserted ${RECORD_COUNT.toLocaleString()} records\n`);

    // 5. VERIFY DATA
    console.log('🔍 Verifying data...');
    const countResult = await session.executeStatement('SELECT COUNT(*) as cnt FROM main.default.koop_large_dataset');
    const countRows = await countResult.fetchAll();
    await countResult.close();

    const count = countRows[0]?.cnt || 0;
    console.log(`   ✅ Confirmed ${count.toLocaleString()} records in table\n`);

    // 6. SAMPLE DATA
    console.log('📋 Sample records:');
    const sampleResult = await session.executeStatement('SELECT * FROM main.default.koop_large_dataset LIMIT 5');
    const sampleRows = await sampleResult.fetchAll();
    await sampleResult.close();

    sampleRows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.business_name} - ${row.city}, ${row.state}`);
      console.log(`      Revenue: $${row.annual_revenue.toLocaleString()}, Employees: ${row.employee_count}`);
      console.log(`      Location: ${row.geometry_wkt}`);
    });

    // Summary
    console.log('\n✅ LARGE DATASET CREATED SUCCESSFULLY!\n');
    console.log('📊 Dataset Information:');
    console.log(`   • Table: main.default.koop_large_dataset`);
    console.log(`   • Records: ${RECORD_COUNT.toLocaleString()}`);
    console.log(`   • Geometry Type: Point`);
    console.log(`   • Coverage: Continental United States`);
    console.log('\n🌐 Test with FeatureServer:');
    console.log('   http://localhost:8082/databricks/rest/services/main.default.koop_large_dataset/FeatureServer/0');
    console.log('\n🧪 Test Pagination:');
    console.log('   • Total count: ...FeatureServer/0/query?returnCountOnly=true');
    console.log('   • First 100:   ...FeatureServer/0/query?resultOffset=0&resultRecordCount=100');
    console.log('   • Next 100:    ...FeatureServer/0/query?resultOffset=100&resultRecordCount=100');
    console.log('   • Last page:   ...FeatureServer/0/query?resultOffset=9900&resultRecordCount=100');

    await session.close();
    await connection.close();
    await client.close();

  } catch (error) {
    console.error('❌ Error creating large dataset:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createLargeDataset()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createLargeDataset };
