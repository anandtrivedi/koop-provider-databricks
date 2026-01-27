/**
 * Create Test Tables in Databricks Community Edition - FIXED
 *
 * This version:
 * 1. Creates the geospatial schema first
 * 2. Then creates the tables in that schema
 */

const { DBSQLClient } = require('@databricks/sql');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME || 'your-workspace.cloud.databricks.com',
  path: process.env.DATABRICKS_HTTP_PATH || '/sql/1.0/warehouses/your-warehouse-id',
  token: process.env.DATABRICKS_TOKEN || 'your_databricks_token'
};

async function createTestLayers() {
  const client = new DBSQLClient();
  const connection = await client.connect({
    host: config.host,
    path: config.path,
    token: config.token
  });

  console.log('✅ Connected to Databricks Community Edition\n');

  try {
    const session = await connection.openSession();

    // 1. CREATE SCHEMA (if it doesn't exist)
    console.log('📁 Creating geospatial schema...');
    try {
      await session.executeStatement('CREATE SCHEMA IF NOT EXISTS geospatial');
      console.log('   ✅ Schema created: geospatial\n');
    } catch (e) {
      console.log('   ℹ️  Schema already exists or error:', e.message, '\n');
    }

    // 2. DROP existing tables (if any)
    console.log('🗑️  Dropping existing test tables...');
    const tablesToDrop = [
      'koop_test_cities',
      'koop_test_highways',
      'koop_test_states',
      'koop_test_parks'
    ];

    for (const table of tablesToDrop) {
      try {
        await session.executeStatement(`DROP TABLE IF EXISTS geospatial.${table}`);
        console.log(`   Dropped geospatial.${table}`);
      } catch (e) {
        console.log(`   geospatial.${table} doesn't exist, skipping`);
      }
    }

    // 3. CREATE CITIES TABLE (Points)
    console.log('\n📍 Creating koop_test_cities table...');
    await session.executeStatement(`
      CREATE TABLE geospatial.koop_test_cities (
        objectid INT,
        city_name STRING,
        state STRING,
        population BIGINT,
        geometry_wkt STRING
      )
    `);

    const cities = [
      { id: 1, name: 'New York', state: 'New York', pop: 8336817, lon: -74.0060, lat: 40.7128 },
      { id: 2, name: 'Los Angeles', state: 'California', pop: 3979576, lon: -118.2437, lat: 34.0522 },
      { id: 3, name: 'Chicago', state: 'Illinois', pop: 2693976, lon: -87.6298, lat: 41.8781 },
      { id: 4, name: 'Houston', state: 'Texas', pop: 2320268, lon: -95.3698, lat: 29.7604 },
      { id: 5, name: 'Phoenix', state: 'Arizona', pop: 1680992, lon: -112.0740, lat: 33.4484 },
      { id: 6, name: 'Philadelphia', state: 'Pennsylvania', pop: 1584064, lon: -75.1652, lat: 39.9526 },
      { id: 7, name: 'San Antonio', state: 'Texas', pop: 1547253, lon: -98.4936, lat: 29.4241 },
      { id: 8, name: 'San Diego', state: 'California', pop: 1423851, lon: -117.1611, lat: 32.7157 },
      { id: 9, name: 'Dallas', state: 'Texas', pop: 1343573, lon: -96.7970, lat: 32.7767 },
      { id: 10, name: 'San Jose', state: 'California', pop: 1021795, lon: -121.8863, lat: 37.3382 }
    ];

    for (const city of cities) {
      await session.executeStatement(`
        INSERT INTO geospatial.koop_test_cities VALUES (
          ${city.id}, '${city.name}', '${city.state}', ${city.pop}, 'POINT(${city.lon} ${city.lat})'
        )
      `);
    }
    console.log(`   ✅ Inserted ${cities.length} cities`);

    // 4. CREATE HIGHWAYS TABLE (LineStrings)
    console.log('\n🛣️  Creating koop_test_highways table...');
    await session.executeStatement(`
      CREATE TABLE geospatial.koop_test_highways (
        objectid INT,
        highway_name STRING,
        highway_number STRING,
        length_miles INT,
        geometry_wkt STRING
      )
    `);

    const highways = [
      { id: 1, name: 'Interstate 5', num: 'I-5', miles: 1381,
        wkt: 'LINESTRING(-117.1611 32.7157, -118.2437 34.0522, -121.8863 37.3382, -122.4194 37.7749, -122.3321 47.6062)' },
      { id: 2, name: 'Interstate 10', num: 'I-10', miles: 2460,
        wkt: 'LINESTRING(-118.2437 34.0522, -112.0740 33.4484, -106.6504 35.0844, -106.4850 31.7619, -98.4936 29.4241, -95.3698 29.7604)' }
    ];

    for (const hwy of highways) {
      await session.executeStatement(`
        INSERT INTO geospatial.koop_test_highways VALUES (
          ${hwy.id}, '${hwy.name}', '${hwy.num}', ${hwy.miles}, '${hwy.wkt}'
        )
      `);
    }
    console.log(`   ✅ Inserted ${highways.length} highways`);

    // 5. CREATE STATES TABLE (Polygons)
    console.log('\n🗺️  Creating koop_test_states table...');
    await session.executeStatement(`
      CREATE TABLE geospatial.koop_test_states (
        objectid INT,
        state_name STRING,
        abbreviation STRING,
        population BIGINT,
        area_sq_miles INT,
        geometry_wkt STRING
      )
    `);

    const states = [
      { id: 1, name: 'California', abbr: 'CA', pop: 39538223, area: 163696,
        wkt: 'POLYGON((-124.4 42.0, -124.4 32.5, -114.1 32.5, -114.1 35.0, -120.0 35.0, -120.0 42.0, -124.4 42.0))' },
      { id: 2, name: 'Texas', abbr: 'TX', pop: 29145505, area: 268596,
        wkt: 'POLYGON((-106.6 31.8, -106.6 36.5, -93.5 36.5, -93.5 29.7, -99.0 26.5, -106.6 31.8))' }
    ];

    for (const state of states) {
      await session.executeStatement(`
        INSERT INTO geospatial.koop_test_states VALUES (
          ${state.id}, '${state.name}', '${state.abbr}', ${state.pop}, ${state.area}, '${state.wkt}'
        )
      `);
    }
    console.log(`   ✅ Inserted ${states.length} states`);

    // 6. CREATE PARKS TABLE (Points)
    console.log('\n🏞️  Creating koop_test_parks table...');
    await session.executeStatement(`
      CREATE TABLE geospatial.koop_test_parks (
        objectid INT,
        park_name STRING,
        state STRING,
        area_acres INT,
        visitors_annual BIGINT,
        geometry_wkt STRING
      )
    `);

    const parks = [
      { id: 1, name: 'Yellowstone', state: 'Wyoming', acres: 2219791, visitors: 4860242, lon: -110.5885, lat: 44.4280 },
      { id: 2, name: 'Grand Canyon', state: 'Arizona', acres: 1201647, visitors: 4532677, lon: -112.1401, lat: 36.0544 },
      { id: 3, name: 'Yosemite', state: 'California', acres: 761747, visitors: 3287595, lon: -119.5383, lat: 37.8651 }
    ];

    for (const park of parks) {
      await session.executeStatement(`
        INSERT INTO geospatial.koop_test_parks VALUES (
          ${park.id}, '${park.name}', '${park.state}', ${park.acres}, ${park.visitors}, 'POINT(${park.lon} ${park.lat})'
        )
      `);
    }
    console.log(`   ✅ Inserted ${parks.length} parks`);

    // 7. VERIFY ALL TABLES
    console.log('\n✅ ALL TEST LAYERS CREATED!\n');
    console.log('📊 Summary:');
    console.log('   • geospatial.koop_test_cities: 10 cities (Points)');
    console.log('   • geospatial.koop_test_highways: 2 highways (LineStrings)');
    console.log('   • geospatial.koop_test_states: 2 states (Polygons)');
    console.log('   • geospatial.koop_test_parks: 3 parks (Points)');
    console.log('\n🌐 Test URLs (once Render is updated):');
    console.log('   https://koop-databricks.onrender.com/databricks/rest/services/geospatial.koop_test_cities/FeatureServer/0');

    await session.close();
    await connection.close();
    await client.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createTestLayers()
  .then(() => {
    console.log('\n✅ Complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
