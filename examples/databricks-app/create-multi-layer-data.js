/**
 * Create Multiple Test Layers with Different Geometry Types
 *
 * This script creates comprehensive test data for demonstrating the Koop provider:
 * 1. koop_test_cities - Points (50+ US cities)
 * 2. koop_test_highways - LineStrings (Major US highways)
 * 3. koop_test_states - Polygons (US state boundaries)
 * 4. koop_test_parks - Points (National parks)
 */

const { DBSQLClient } = require('@databricks/sql');

// Connection config from environment
const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME,
  path: process.env.DATABRICKS_HTTP_PATH,
  token: process.env.DATABRICKS_TOKEN
};

async function createTestLayers() {
  const client = new DBSQLClient();
  const connection = await client.connect({
    host: config.host,
    path: config.path,
    token: config.token
  });

  console.log('✅ Connected to Databricks\n');

  try {
    const session = await connection.openSession();

    // 1. DROP existing tables
    console.log('🗑️  Dropping existing test tables...');
    const tablesToDrop = [
      'main.default.koop_test_cities',
      'main.default.koop_test_highways',
      'main.default.koop_test_states',
      'main.default.koop_test_parks'
    ];

    for (const table of tablesToDrop) {
      try {
        await session.executeStatement(`DROP TABLE IF EXISTS ${table}`);
        console.log(`   Dropped ${table}`);
      } catch (e) {
        console.log(`   ${table} doesn't exist, skipping`);
      }
    }

    // 2. CREATE CITIES TABLE (Points - 50 cities)
    console.log('\n📍 Creating koop_test_cities table with 50 cities...');

    await session.executeStatement(`
      CREATE TABLE main.default.koop_test_cities (
        objectid INT,
        city_name STRING,
        state STRING,
        population BIGINT,
        geometry_wkt STRING
      )
    `);

    const cities = [
      // Major cities
      { id: 1, name: 'New York', state: 'New York', pop: 8336817, lon: -74.0060, lat: 40.7128 },
      { id: 2, name: 'Los Angeles', state: 'California', pop: 3979576, lon: -118.2437, lat: 34.0522 },
      { id: 3, name: 'Chicago', state: 'Illinois', pop: 2693976, lon: -87.6298, lat: 41.8781 },
      { id: 4, name: 'Houston', state: 'Texas', pop: 2320268, lon: -95.3698, lat: 29.7604 },
      { id: 5, name: 'Phoenix', state: 'Arizona', pop: 1680992, lon: -112.0740, lat: 33.4484 },
      { id: 6, name: 'Philadelphia', state: 'Pennsylvania', pop: 1584064, lon: -75.1652, lat: 39.9526 },
      { id: 7, name: 'San Antonio', state: 'Texas', pop: 1547253, lon: -98.4936, lat: 29.4241 },
      { id: 8, name: 'San Diego', state: 'California', pop: 1423851, lon: -117.1611, lat: 32.7157 },
      { id: 9, name: 'Dallas', state: 'Texas', pop: 1343573, lon: -96.7970, lat: 32.7767 },
      { id: 10, name: 'San Jose', state: 'California', pop: 1021795, lon: -121.8863, lat: 37.3382 },

      // Additional major cities
      { id: 11, name: 'Austin', state: 'Texas', pop: 978908, lon: -97.7431, lat: 30.2672 },
      { id: 12, name: 'Jacksonville', state: 'Florida', pop: 911507, lon: -81.6557, lat: 30.3322 },
      { id: 13, name: 'San Francisco', state: 'California', pop: 881549, lon: -122.4194, lat: 37.7749 },
      { id: 14, name: 'Columbus', state: 'Ohio', pop: 898553, lon: -82.9988, lat: 39.9612 },
      { id: 15, name: 'Indianapolis', state: 'Indiana', pop: 876384, lon: -86.1581, lat: 39.7684 },
      { id: 16, name: 'Fort Worth', state: 'Texas', pop: 918915, lon: -97.3308, lat: 32.7555 },
      { id: 17, name: 'Charlotte', state: 'North Carolina', pop: 885708, lon: -80.8431, lat: 35.2271 },
      { id: 18, name: 'Seattle', state: 'Washington', pop: 753675, lon: -122.3321, lat: 47.6062 },
      { id: 19, name: 'Denver', state: 'Colorado', pop: 727211, lon: -104.9903, lat: 39.7392 },
      { id: 20, name: 'Washington', state: 'District of Columbia', pop: 705749, lon: -77.0369, lat: 38.9072 },

      // More cities
      { id: 21, name: 'Boston', state: 'Massachusetts', pop: 692600, lon: -71.0589, lat: 42.3601 },
      { id: 22, name: 'El Paso', state: 'Texas', pop: 681728, lon: -106.4850, lat: 31.7619 },
      { id: 23, name: 'Nashville', state: 'Tennessee', pop: 689447, lon: -86.7816, lat: 36.1627 },
      { id: 24, name: 'Detroit', state: 'Michigan', pop: 672662, lon: -83.0458, lat: 42.3314 },
      { id: 25, name: 'Oklahoma City', state: 'Oklahoma', pop: 649021, lon: -97.5164, lat: 35.4676 },
      { id: 26, name: 'Portland', state: 'Oregon', pop: 654741, lon: -122.6765, lat: 45.5152 },
      { id: 27, name: 'Las Vegas', state: 'Nevada', pop: 641903, lon: -115.1398, lat: 36.1699 },
      { id: 28, name: 'Memphis', state: 'Tennessee', pop: 651073, lon: -90.0490, lat: 35.1495 },
      { id: 29, name: 'Louisville', state: 'Kentucky', pop: 617638, lon: -85.7585, lat: 38.2527 },
      { id: 30, name: 'Baltimore', state: 'Maryland', pop: 585708, lon: -76.6122, lat: 39.2904 },

      // Additional cities
      { id: 31, name: 'Milwaukee', state: 'Wisconsin', pop: 594833, lon: -87.9065, lat: 43.0389 },
      { id: 32, name: 'Albuquerque', state: 'New Mexico', pop: 560513, lon: -106.6504, lat: 35.0844 },
      { id: 33, name: 'Tucson', state: 'Arizona', pop: 548073, lon: -110.9747, lat: 32.2226 },
      { id: 34, name: 'Fresno', state: 'California', pop: 542107, lon: -119.7871, lat: 36.7378 },
      { id: 35, name: 'Sacramento', state: 'California', pop: 524943, lon: -121.4944, lat: 38.5816 },
      { id: 36, name: 'Mesa', state: 'Arizona', pop: 518012, lon: -111.8315, lat: 33.4152 },
      { id: 37, name: 'Kansas City', state: 'Missouri', pop: 508090, lon: -94.5786, lat: 39.0997 },
      { id: 38, name: 'Atlanta', state: 'Georgia', pop: 498715, lon: -84.3880, lat: 33.7490 },
      { id: 39, name: 'Long Beach', state: 'California', pop: 466742, lon: -118.1937, lat: 33.7701 },
      { id: 40, name: 'Omaha', state: 'Nebraska', pop: 486051, lon: -95.9345, lat: 41.2565 },

      // Final cities
      { id: 41, name: 'Raleigh', state: 'North Carolina', pop: 474069, lon: -78.6382, lat: 35.7796 },
      { id: 42, name: 'Miami', state: 'Florida', pop: 442241, lon: -80.1918, lat: 25.7617 },
      { id: 43, name: 'Oakland', state: 'California', pop: 433031, lon: -122.2712, lat: 37.8044 },
      { id: 44, name: 'Minneapolis', state: 'Minnesota', pop: 429954, lon: -93.2650, lat: 44.9778 },
      { id: 45, name: 'Tulsa', state: 'Oklahoma', pop: 413066, lon: -95.9928, lat: 36.1540 },
      { id: 46, name: 'Cleveland', state: 'Ohio', pop: 372624, lon: -81.6944, lat: 41.4993 },
      { id: 47, name: 'Wichita', state: 'Kansas', pop: 397532, lon: -97.3301, lat: 37.6872 },
      { id: 48, name: 'Arlington', state: 'Texas', pop: 398121, lon: -97.1081, lat: 32.7357 },
      { id: 49, name: 'New Orleans', state: 'Louisiana', pop: 383997, lon: -90.0715, lat: 29.9511 },
      { id: 50, name: 'Bakersfield', state: 'California', pop: 403455, lon: -119.0187, lat: 35.3733 }
    ];

    for (const city of cities) {
      await session.executeStatement(`
        INSERT INTO main.default.koop_test_cities VALUES (
          ${city.id},
          '${city.name}',
          '${city.state}',
          ${city.pop},
          'POINT(${city.lon} ${city.lat})'
        )
      `);
    }
    console.log(`   ✅ Inserted ${cities.length} cities`);

    // 3. CREATE HIGHWAYS TABLE (LineStrings)
    console.log('\n🛣️  Creating koop_test_highways table...');

    await session.executeStatement(`
      CREATE TABLE main.default.koop_test_highways (
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
        wkt: 'LINESTRING(-118.2437 34.0522, -112.0740 33.4484, -106.6504 35.0844, -106.4850 31.7619, -98.4936 29.4241, -95.3698 29.7604)' },
      { id: 3, name: 'Interstate 95', num: 'I-95', miles: 1908,
        wkt: 'LINESTRING(-80.1918 25.7617, -81.6557 30.3322, -80.8431 35.2271, -77.0369 38.9072, -75.1652 39.9526, -74.0060 40.7128, -71.0589 42.3601)' },
      { id: 4, name: 'Interstate 80', num: 'I-80', miles: 2900,
        wkt: 'LINESTRING(-122.4194 37.7749, -121.4944 38.5816, -119.7871 36.7378, -112.0740 33.4484, -104.9903 39.7392, -95.9345 41.2565, -87.6298 41.8781, -83.0458 42.3314, -82.9988 39.9612, -74.0060 40.7128)' },
      { id: 5, name: 'Interstate 40', num: 'I-40', miles: 2555,
        wkt: 'LINESTRING(-118.2437 34.0522, -112.0740 33.4484, -106.6504 35.0844, -97.5164 35.4676, -95.9928 36.1540, -90.0490 35.1495, -86.7816 36.1627, -84.3880 33.7490, -80.8431 35.2271)' }
    ];

    for (const hwy of highways) {
      await session.executeStatement(`
        INSERT INTO main.default.koop_test_highways VALUES (
          ${hwy.id},
          '${hwy.name}',
          '${hwy.num}',
          ${hwy.miles},
          '${hwy.wkt}'
        )
      `);
    }
    console.log(`   ✅ Inserted ${highways.length} highways`);

    // 4. CREATE STATES TABLE (Polygons - simplified boundaries)
    console.log('\n🗺️  Creating koop_test_states table...');

    await session.executeStatement(`
      CREATE TABLE main.default.koop_test_states (
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
        wkt: 'POLYGON((-106.6 31.8, -106.6 36.5, -93.5 36.5, -93.5 29.7, -99.0 26.5, -106.6 31.8))' },
      { id: 3, name: 'Florida', abbr: 'FL', pop: 21538187, area: 65758,
        wkt: 'POLYGON((-87.6 31.0, -87.6 30.2, -85.0 29.6, -80.0 25.0, -80.0 31.0, -87.6 31.0))' },
      { id: 4, name: 'New York', abbr: 'NY', pop: 20201249, area: 54555,
        wkt: 'POLYGON((-79.8 42.0, -79.8 40.5, -71.8 40.5, -71.8 45.0, -79.8 45.0, -79.8 42.0))' },
      { id: 5, name: 'Colorado', abbr: 'CO', pop: 5773714, area: 104094,
        wkt: 'POLYGON((-109.0 37.0, -109.0 41.0, -102.0 41.0, -102.0 37.0, -109.0 37.0))' }
    ];

    for (const state of states) {
      await session.executeStatement(`
        INSERT INTO main.default.koop_test_states VALUES (
          ${state.id},
          '${state.name}',
          '${state.abbr}',
          ${state.pop},
          ${state.area},
          '${state.wkt}'
        )
      `);
    }
    console.log(`   ✅ Inserted ${states.length} states`);

    // 5. CREATE PARKS TABLE (Points - National Parks)
    console.log('\n🏞️  Creating koop_test_parks table...');

    await session.executeStatement(`
      CREATE TABLE main.default.koop_test_parks (
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
      { id: 3, name: 'Yosemite', state: 'California', acres: 761747, visitors: 3287595, lon: -119.5383, lat: 37.8651 },
      { id: 4, name: 'Zion', state: 'Utah', acres: 147237, visitors: 4692417, lon: -113.0263, lat: 37.2982 },
      { id: 5, name: 'Rocky Mountain', state: 'Colorado', acres: 265807, visitors: 4670053, lon: -105.6836, lat: 40.3428 },
      { id: 6, name: 'Acadia', state: 'Maine', acres: 49075, visitors: 3437286, lon: -68.2733, lat: 44.3386 },
      { id: 7, name: 'Grand Teton', state: 'Wyoming', acres: 310044, visitors: 3289638, lon: -110.8024, lat: 43.7904 },
      { id: 8, name: 'Olympic', state: 'Washington', acres: 922649, visitors: 2718925, lon: -123.4985, lat: 47.8021 },
      { id: 9, name: 'Glacier', state: 'Montana', acres: 1013126, visitors: 1698864, lon: -113.7870, lat: 48.7596 },
      { id: 10, name: 'Joshua Tree', state: 'California', acres: 795156, visitors: 2988547, lon: -115.9010, lat: 33.8734 }
    ];

    for (const park of parks) {
      await session.executeStatement(`
        INSERT INTO main.default.koop_test_parks VALUES (
          ${park.id},
          '${park.name}',
          '${park.state}',
          ${park.acres},
          ${park.visitors},
          'POINT(${park.lon} ${park.lat})'
        )
      `);
    }
    console.log(`   ✅ Inserted ${parks.length} national parks`);

    // Summary
    console.log('\n✅ ALL TEST LAYERS CREATED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log('   • koop_test_cities: 50 cities (Points)');
    console.log('   • koop_test_highways: 5 highways (LineStrings)');
    console.log('   • koop_test_states: 5 states (Polygons)');
    console.log('   • koop_test_parks: 10 national parks (Points)');
    console.log('\n🌐 Test these layers at:');
    console.log('   http://localhost:8082/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0');
    console.log('   http://localhost:8082/databricks/rest/services/main.default.koop_test_highways/FeatureServer/0');
    console.log('   http://localhost:8082/databricks/rest/services/main.default.koop_test_states/FeatureServer/0');
    console.log('   http://localhost:8082/databricks/rest/services/main.default.koop_test_parks/FeatureServer/0');

    await session.close();
    await connection.close();
    await client.close();

  } catch (error) {
    console.error('❌ Error creating test layers:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createTestLayers()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createTestLayers };
