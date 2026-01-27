/**
 * Create Large Test Dataset - 10,000 US Cities
 *
 * This creates a realistic dataset of 10,000 cities across the United States
 * with random but geographically accurate coordinates and attributes.
 */

const { DBSQLClient } = require('@databricks/sql');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME || 'your-workspace.cloud.databricks.com',
  path: process.env.DATABRICKS_HTTP_PATH || '/sql/1.0/warehouses/your-warehouse-id',
  token: process.env.DATABRICKS_TOKEN || 'your_databricks_token'
};

// US States with approximate coordinate boundaries
const states = [
  { name: 'California', abbr: 'CA', minLon: -124.4, maxLon: -114.1, minLat: 32.5, maxLat: 42.0 },
  { name: 'Texas', abbr: 'TX', minLon: -106.6, maxLon: -93.5, minLat: 25.8, maxLat: 36.5 },
  { name: 'Florida', abbr: 'FL', minLon: -87.6, maxLon: -80.0, minLat: 24.5, maxLat: 31.0 },
  { name: 'New York', abbr: 'NY', minLon: -79.8, maxLon: -71.8, minLat: 40.5, maxLat: 45.0 },
  { name: 'Pennsylvania', abbr: 'PA', minLon: -80.5, maxLon: -74.7, minLat: 39.7, maxLat: 42.3 },
  { name: 'Illinois', abbr: 'IL', minLon: -91.5, maxLon: -87.5, minLat: 36.9, maxLat: 42.5 },
  { name: 'Ohio', abbr: 'OH', minLon: -84.8, maxLon: -80.5, minLat: 38.4, maxLat: 42.3 },
  { name: 'Georgia', abbr: 'GA', minLon: -85.6, maxLon: -80.8, minLat: 30.3, maxLat: 35.0 },
  { name: 'North Carolina', abbr: 'NC', minLon: -84.3, maxLon: -75.4, minLat: 33.8, maxLat: 36.6 },
  { name: 'Michigan', abbr: 'MI', minLon: -90.4, maxLon: -82.1, minLat: 41.7, maxLat: 48.3 },
  { name: 'New Jersey', abbr: 'NJ', minLon: -75.6, maxLon: -73.9, minLat: 38.9, maxLat: 41.4 },
  { name: 'Virginia', abbr: 'VA', minLon: -83.7, maxLon: -75.2, minLat: 36.5, maxLat: 39.5 },
  { name: 'Washington', abbr: 'WA', minLon: -124.8, maxLon: -116.9, minLat: 45.5, maxLat: 49.0 },
  { name: 'Arizona', abbr: 'AZ', minLon: -114.8, maxLon: -109.0, minLat: 31.3, maxLat: 37.0 },
  { name: 'Massachusetts', abbr: 'MA', minLon: -73.5, maxLon: -69.9, minLat: 41.2, maxLat: 42.9 },
  { name: 'Tennessee', abbr: 'TN', minLon: -90.3, maxLon: -81.6, minLat: 34.9, maxLat: 36.7 },
  { name: 'Indiana', abbr: 'IN', minLon: -88.1, maxLon: -84.8, minLat: 37.8, maxLat: 41.8 },
  { name: 'Missouri', abbr: 'MO', minLon: -95.8, maxLon: -89.1, minLat: 36.0, maxLat: 40.6 },
  { name: 'Maryland', abbr: 'MD', minLon: -79.5, maxLon: -75.0, minLat: 37.9, maxLat: 39.7 },
  { name: 'Wisconsin', abbr: 'WI', minLon: -92.9, maxLon: -86.2, minLat: 42.5, maxLat: 47.3 },
  { name: 'Colorado', abbr: 'CO', minLon: -109.0, maxLon: -102.0, minLat: 37.0, maxLat: 41.0 },
  { name: 'Minnesota', abbr: 'MN', minLon: -97.2, maxLon: -89.5, minLat: 43.5, maxLat: 49.4 },
  { name: 'South Carolina', abbr: 'SC', minLon: -83.4, maxLon: -78.5, minLat: 32.0, maxLat: 35.2 },
  { name: 'Alabama', abbr: 'AL', minLon: -88.5, maxLon: -84.9, minLat: 30.2, maxLat: 35.0 },
  { name: 'Louisiana', abbr: 'LA', minLon: -94.0, maxLon: -88.8, minLat: 28.9, maxLat: 33.0 },
  { name: 'Kentucky', abbr: 'KY', minLon: -89.6, maxLon: -81.9, minLat: 36.5, maxLat: 39.1 },
  { name: 'Oregon', abbr: 'OR', minLon: -124.6, maxLon: -116.5, minLat: 41.9, maxLat: 46.3 },
  { name: 'Oklahoma', abbr: 'OK', minLon: -103.0, maxLon: -94.4, minLat: 33.6, maxLat: 37.0 },
  { name: 'Connecticut', abbr: 'CT', minLon: -73.7, maxLon: -71.8, minLat: 40.9, maxLat: 42.1 },
  { name: 'Iowa', abbr: 'IA', minLon: -96.6, maxLon: -90.1, minLat: 40.4, maxLat: 43.5 }
];

// City name prefixes and suffixes for generating realistic names
const prefixes = [
  'New', 'Old', 'North', 'South', 'East', 'West', 'Lake', 'Mount', 'Fort', 'Port',
  'San', 'Santa', 'Saint', 'Grand', 'Little', 'Big', 'Upper', 'Lower', 'Spring', 'River'
];

const bases = [
  'Springfield', 'Franklin', 'Clinton', 'Madison', 'Washington', 'Georgetown', 'Salem',
  'Riverside', 'Greenville', 'Bristol', 'Fairview', 'Manchester', 'Oxford', 'Richmond',
  'Arlington', 'Clayton', 'Jackson', 'Monroe', 'Lincoln', 'Jefferson', 'Hamilton',
  'Chester', 'Newport', 'Ashland', 'Dover', 'Highland', 'Summit', 'Valley', 'Crestview',
  'Woodland', 'Oakdale', 'Hillside', 'Lakeside', 'Meadow', 'Parkview', 'Brookside'
];

function generateCityName(id) {
  if (id % 3 === 0) {
    return prefixes[id % prefixes.length] + ' ' + bases[id % bases.length];
  } else {
    return bases[id % bases.length];
  }
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function generatePopulation() {
  // Generate realistic city populations (1,000 to 5,000,000)
  const rand = Math.random();
  if (rand < 0.7) return Math.floor(1000 + Math.random() * 50000); // Small cities
  if (rand < 0.9) return Math.floor(50000 + Math.random() * 200000); // Medium cities
  return Math.floor(200000 + Math.random() * 4800000); // Large cities
}

async function createLargeDataset() {
  const client = new DBSQLClient();
  const connection = await client.connect({
    host: config.host,
    path: config.path,
    token: config.token
  });

  console.log('✅ Connected to Databricks Community Edition\n');

  try {
    const session = await connection.openSession();

    // 1. Create or replace the large cities table
    console.log('📊 Creating large_us_cities table...');

    await session.executeStatement('DROP TABLE IF EXISTS geospatial.large_us_cities');

    await session.executeStatement(`
      CREATE TABLE geospatial.large_us_cities (
        objectid INT,
        city_name STRING,
        state STRING,
        state_abbr STRING,
        population BIGINT,
        area_sq_miles DOUBLE,
        median_income INT,
        elevation_ft INT,
        geometry_wkt STRING
      )
    `);

    console.log('   ✅ Table created\n');

    // 2. Generate and insert 10,000 cities
    console.log('📍 Generating 10,000 cities...');
    console.log('   (This will take 2-3 minutes)\n');

    const batchSize = 100; // Insert 100 cities at a time for efficiency
    let totalInserted = 0;

    for (let batch = 0; batch < 100; batch++) {
      const insertValues = [];

      for (let i = 0; i < batchSize; i++) {
        const id = batch * batchSize + i + 1;
        const state = states[id % states.length];
        const cityName = generateCityName(id);
        const lon = randomInRange(state.minLon, state.maxLon);
        const lat = randomInRange(state.minLat, state.maxLat);
        const population = generatePopulation();
        const area = Math.round(randomInRange(1, 500) * 10) / 10;
        const income = Math.floor(30000 + Math.random() * 90000);
        const elevation = Math.floor(Math.random() * 8000);
        const wkt = `POINT(${lon.toFixed(4)} ${lat.toFixed(4)})`;

        insertValues.push(
          `(${id}, '${cityName}', '${state.name}', '${state.abbr}', ${population}, ${area}, ${income}, ${elevation}, '${wkt}')`
        );
      }

      // Batch insert
      const insertSQL = `
        INSERT INTO geospatial.large_us_cities VALUES
        ${insertValues.join(',\n        ')}
      `;

      await session.executeStatement(insertSQL);

      totalInserted += batchSize;

      // Progress indicator every 1000 records
      if (totalInserted % 1000 === 0) {
        console.log(`   ✅ Inserted ${totalInserted} cities...`);
      }
    }

    console.log(`\n🎉 Successfully inserted ${totalInserted} cities!\n`);

    // 3. Verify the data
    console.log('🔍 Verifying data...');

    const countStmt = await session.executeStatement('SELECT COUNT(*) as count FROM geospatial.large_us_cities');
    const countResult = await countStmt.fetchAll();
    await countStmt.close();

    const recordCount = countResult[0].count;
    console.log(`   ✅ Total records: ${recordCount}\n`);

    // Show some sample data
    const sampleStmt = await session.executeStatement(`
      SELECT city_name, state, population, geometry_wkt
      FROM geospatial.large_us_cities
      ORDER BY population DESC
      LIMIT 5
    `);
    const sampleResult = await sampleStmt.fetchAll();
    await sampleStmt.close();

    console.log('📊 Top 5 cities by population:');
    sampleResult.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.city_name}, ${row.state} - Pop: ${row.population.toLocaleString()}`);
    });

    console.log('\n✅ COMPLETE!\n');
    console.log('🌐 Layer URL:');
    console.log('   https://koop-databricks.onrender.com/databricks/rest/services/geospatial.large_us_cities/FeatureServer/0');
    console.log('\n📍 Add this URL to ArcGIS Online to see 10,000 cities!\n');

    await session.close();
    await connection.close();
    await client.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createLargeDataset()
  .then(() => {
    console.log('✅ Script complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
