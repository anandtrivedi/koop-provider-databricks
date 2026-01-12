/**
 * Create Large Multi-Geometry Dataset for Enterprise-Scale Testing
 *
 * This script creates 3 large tables with different geometry types:
 * 1. koop_large_businesses - 10,000 point locations (businesses)
 * 2. koop_large_parcels - 5,000 polygons (property parcels)
 * 3. koop_large_roads - 3,000 linestrings (road segments)
 *
 * Total: 18,000 features to demonstrate enterprise-scale performance
 */

const { DBSQLClient } = require('@databricks/sql');

// Connection config from environment
const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME,
  path: process.env.DATABRICKS_HTTP_PATH,
  token: process.env.DATABRICKS_TOKEN
};

// Generate business point locations
function generateBusinesses(count) {
  const businessTypes = ['Store', 'Restaurant', 'Office', 'Warehouse', 'Shop', 'Cafe', 'Market', 'Mall', 'Center', 'Plaza'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA'];

  const records = [];
  for (let i = 1; i <= count; i++) {
    const businessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
    const cityIndex = Math.floor(Math.random() * cities.length);

    // Random US coordinates
    const lon = -125 + Math.random() * 59;
    const lat = 24 + Math.random() * 25;

    const revenue = Math.floor(50000 + Math.random() * 4950000);
    const employees = Math.floor(1 + Math.random() * 500);

    records.push({
      id: i,
      name: `${businessType} ${i}`,
      city: cities[cityIndex],
      state: states[cityIndex],
      revenue: revenue,
      employees: employees,
      wkt: `POINT(${lon.toFixed(6)} ${lat.toFixed(6)})`
    });
  }
  return records;
}

// Generate property parcels (simplified rectangular polygons)
function generateParcels(count) {
  const zoneTypes = ['Residential', 'Commercial', 'Industrial', 'Mixed Use', 'Agricultural', 'Recreational'];
  const records = [];

  for (let i = 1; i <= count; i++) {
    // Random center point in US
    const centerLon = -125 + Math.random() * 59;
    const centerLat = 24 + Math.random() * 25;

    // Random parcel size (0.001 to 0.01 degrees, roughly 100m to 1km)
    const width = 0.001 + Math.random() * 0.009;
    const height = 0.001 + Math.random() * 0.009;

    // Create rectangular parcel
    const minLon = centerLon - width / 2;
    const maxLon = centerLon + width / 2;
    const minLat = centerLat - height / 2;
    const maxLat = centerLat + height / 2;

    const wkt = `POLYGON((${minLon.toFixed(6)} ${minLat.toFixed(6)}, ${maxLon.toFixed(6)} ${minLat.toFixed(6)}, ${maxLon.toFixed(6)} ${maxLat.toFixed(6)}, ${minLon.toFixed(6)} ${maxLat.toFixed(6)}, ${minLon.toFixed(6)} ${minLat.toFixed(6)}))`;

    const zoneType = zoneTypes[Math.floor(Math.random() * zoneTypes.length)];
    const area = Math.floor(width * height * 111000 * 111000); // Rough conversion to m²
    const value = Math.floor(100000 + Math.random() * 9900000);

    records.push({
      id: i,
      parcel_id: `P${String(i).padStart(6, '0')}`,
      zone_type: zoneType,
      area_sqm: area,
      assessed_value: value,
      wkt: wkt
    });
  }
  return records;
}

// Generate road segments (linestrings)
function generateRoads(count) {
  const roadTypes = ['Highway', 'Avenue', 'Street', 'Boulevard', 'Drive', 'Road', 'Lane', 'Way'];
  const records = [];

  for (let i = 1; i <= count; i++) {
    // Random start point in US
    const startLon = -125 + Math.random() * 59;
    const startLat = 24 + Math.random() * 25;

    // Generate 3-5 points for the road segment
    const numPoints = 3 + Math.floor(Math.random() * 3);
    const points = [[startLon, startLat]];

    let currentLon = startLon;
    let currentLat = startLat;

    for (let j = 1; j < numPoints; j++) {
      // Move 0.01 to 0.05 degrees in a random direction
      const distance = 0.01 + Math.random() * 0.04;
      const angle = Math.random() * 2 * Math.PI;
      currentLon += distance * Math.cos(angle);
      currentLat += distance * Math.sin(angle);
      points.push([currentLon, currentLat]);
    }

    const wkt = `LINESTRING(${points.map(p => `${p[0].toFixed(6)} ${p[1].toFixed(6)}`).join(', ')})`;

    const roadType = roadTypes[Math.floor(Math.random() * roadTypes.length)];
    const length = Math.floor(100 + Math.random() * 9900); // meters
    const lanes = 2 + Math.floor(Math.random() * 4);

    records.push({
      id: i,
      road_name: `${roadType} ${i}`,
      road_type: roadType,
      length_m: length,
      num_lanes: lanes,
      speed_limit: 25 + Math.floor(Math.random() / 0.5) * 5, // 25, 30, 35, 40, 45, 50, 55, 60, 65
      wkt: wkt
    });
  }
  return records;
}

async function createTable(session, tableName, createSQL, records, batchSize = 100) {
  console.log(`\n📊 Creating ${tableName}...`);

  // Drop existing
  try {
    await session.executeStatement(`DROP TABLE IF EXISTS ${tableName}`);
    console.log(`   🗑️  Dropped existing table`);
  } catch (e) {
    // Ignore
  }

  // Create table
  await session.executeStatement(createSQL);
  console.log(`   ✅ Table created`);

  // Insert data in batches
  console.log(`   💾 Inserting ${records.length.toLocaleString()} records...`);
  const totalBatches = Math.ceil(records.length / batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, records.length);
    const batchRecords = records.slice(start, end);

    const values = batchRecords.map(r => {
      // Build value string based on record structure
      if (r.name) {
        // Business record
        return `(${r.id}, '${r.name.replace(/'/g, "''")}', '${r.city}', '${r.state}', ${r.revenue}, ${r.employees}, '${r.wkt}')`;
      } else if (r.parcel_id) {
        // Parcel record
        return `(${r.id}, '${r.parcel_id}', '${r.zone_type}', ${r.area_sqm}, ${r.assessed_value}, '${r.wkt}')`;
      } else {
        // Road record
        return `(${r.id}, '${r.road_name.replace(/'/g, "''")}', '${r.road_type}', ${r.length_m}, ${r.num_lanes}, ${r.speed_limit}, '${r.wkt}')`;
      }
    }).join(',\n        ');

    await session.executeStatement(`INSERT INTO ${tableName} VALUES ${values}`);

    const progress = Math.round(((batch + 1) / totalBatches) * 100);
    process.stdout.write(`   Progress: ${progress}% (${end.toLocaleString()} / ${records.length.toLocaleString()} records)\r`);
  }

  console.log(`\n   ✅ Inserted ${records.length.toLocaleString()} records`);

  // Verify
  const countResult = await session.executeStatement(`SELECT COUNT(*) as cnt FROM ${tableName}`);
  const countRows = await countResult.fetchAll();
  await countResult.close();
  console.log(`   ✅ Verified ${countRows[0]?.cnt.toLocaleString()} records`);
}

async function createLargeMultiGeometryDataset() {
  const BUSINESS_COUNT = 10000;
  const PARCEL_COUNT = 5000;
  const ROAD_COUNT = 3000;

  const client = new DBSQLClient();
  const connection = await client.connect({
    host: config.host,
    path: config.path,
    token: config.token
  });

  console.log('✅ Connected to Databricks\n');
  console.log('🎲 Generating synthetic data for 3 tables...\n');

  try {
    const session = await connection.openSession();

    // Generate all data first
    console.log('Generating businesses (points)...');
    const businesses = generateBusinesses(BUSINESS_COUNT);

    console.log('Generating parcels (polygons)...');
    const parcels = generateParcels(PARCEL_COUNT);

    console.log('Generating roads (linestrings)...');
    const roads = generateRoads(ROAD_COUNT);

    console.log('\n✅ All data generated!\n');
    console.log('═'.repeat(60));

    // Create businesses table (points)
    await createTable(
      session,
      'main.default.koop_large_businesses',
      `CREATE TABLE main.default.koop_large_businesses (
        objectid INT,
        business_name STRING,
        city STRING,
        state STRING,
        annual_revenue BIGINT,
        employee_count INT,
        geometry_wkt STRING
      )`,
      businesses
    );

    console.log('\n' + '═'.repeat(60));

    // Create parcels table (polygons)
    await createTable(
      session,
      'main.default.koop_large_parcels',
      `CREATE TABLE main.default.koop_large_parcels (
        objectid INT,
        parcel_id STRING,
        zone_type STRING,
        area_sqm INT,
        assessed_value BIGINT,
        geometry_wkt STRING
      )`,
      parcels
    );

    console.log('\n' + '═'.repeat(60));

    // Create roads table (linestrings)
    await createTable(
      session,
      'main.default.koop_large_roads',
      `CREATE TABLE main.default.koop_large_roads (
        objectid INT,
        road_name STRING,
        road_type STRING,
        length_m INT,
        num_lanes INT,
        speed_limit INT,
        geometry_wkt STRING
      )`,
      roads
    );

    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ ALL TABLES CREATED SUCCESSFULLY!\n');
    console.log('📊 Dataset Summary:');
    console.log(`   • Total Features: ${(BUSINESS_COUNT + PARCEL_COUNT + ROAD_COUNT).toLocaleString()}`);
    console.log(`   • Business Locations (Points): ${BUSINESS_COUNT.toLocaleString()}`);
    console.log(`   • Property Parcels (Polygons): ${PARCEL_COUNT.toLocaleString()}`);
    console.log(`   • Road Segments (LineStrings): ${ROAD_COUNT.toLocaleString()}`);
    console.log(`   • Coverage: Continental United States`);
    console.log('\n🌐 Test with FeatureServer:');
    console.log('   Businesses: http://localhost:8082/databricks/rest/services/main.default.koop_large_businesses/FeatureServer/0');
    console.log('   Parcels:    http://localhost:8082/databricks/rest/services/main.default.koop_large_parcels/FeatureServer/0');
    console.log('   Roads:      http://localhost:8082/databricks/rest/services/main.default.koop_large_roads/FeatureServer/0');
    console.log('\n🧪 Test Pagination (example with businesses):');
    console.log('   • Total count: .../query?returnCountOnly=true');
    console.log('   • First 100:   .../query?resultOffset=0&resultRecordCount=100');
    console.log('   • Page 51:     .../query?resultOffset=5000&resultRecordCount=100');

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
  createLargeMultiGeometryDataset()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createLargeMultiGeometryDataset };
