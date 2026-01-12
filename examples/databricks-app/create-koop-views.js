const { DBSQLClient } = require('@databricks/sql');

const config = {
  host: process.env.DATABRICKS_SERVER_HOSTNAME || 'your-workspace.cloud.databricks.com',
  path: process.env.DATABRICKS_HTTP_PATH || '/sql/1.0/warehouses/your-warehouse-id',
  token: process.env.DATABRICKS_TOKEN || 'your-databricks-token'
};

async function createKoopViews() {
  const client = new DBSQLClient();

  try {
    const conn = await client.connect(config);
    const session = await conn.openSession();

    console.log('✅ Connected to Databricks');
    console.log('📊 Creating Koop-compatible views with WKT geometry...\n');

    // View 1: cases_silver_koop - Crime incident locations (8 records)
    console.log('Creating pubsec_geo_law.demo.cases_silver_koop...');
    await session.executeStatement(`
      CREATE OR REPLACE VIEW pubsec_geo_law.demo.cases_silver_koop AS
      SELECT
        case_id,
        case_type,
        city,
        state,
        address,
        incident_time_bucket,
        h3_cell,
        latitude,
        longitude,
        status as case_status,
        priority,
        narrative,
        method_of_entry,
        target_items,
        estimated_loss,
        incident_start_ts,
        incident_end_ts,
        CONCAT('POINT(', CAST(longitude AS STRING), ' ', CAST(latitude AS STRING), ')') as geometry,
        ROW_NUMBER() OVER (ORDER BY incident_start_ts) as objectid
      FROM pubsec_geo_law.demo.cases_silver
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `, { runAsync: true });
    console.log('✅ Created cases_silver_koop (Crime Cases)\n');

    // View 2: cell_device_counts_koop - H3 cell activity heatmap (22K records)
    console.log('Creating pubsec_geo_law.demo.cell_device_counts_koop...');
    await session.executeStatement(`
      CREATE OR REPLACE VIEW pubsec_geo_law.demo.cell_device_counts_koop AS
      SELECT
        h3_cell,
        time_bucket,
        city,
        state,
        device_count,
        center_lat,
        center_lon,
        first_event,
        last_event,
        is_high_activity,
        activity_category,
        CONCAT('POINT(', CAST(center_lon AS STRING), ' ', CAST(center_lat AS STRING), ')') as geometry,
        ROW_NUMBER() OVER (ORDER BY device_count DESC) as objectid
      FROM pubsec_geo_law.demo.cell_device_counts
      WHERE center_lat IS NOT NULL AND center_lon IS NOT NULL
    `, { runAsync: true });
    console.log('✅ Created cell_device_counts_koop (Device Activity Heatmap)\n');

    // View 3: device_locations_sample_koop - Sample of device locations (limit to 10K for performance)
    console.log('Creating pubsec_geo_law.demo.device_locations_sample_koop...');
    await session.executeStatement(`
      CREATE OR REPLACE VIEW pubsec_geo_law.demo.device_locations_sample_koop AS
      SELECT
        device_id,
        event_id,
        h3_cell,
        latitude,
        longitude,
        event_timestamp,
        time_bucket,
        city,
        state,
        person_id,
        display_name,
        alias,
        person_role,
        risk_level,
        is_suspect_device,
        is_top_suspect,
        display_label,
        CONCAT('POINT(', CAST(longitude AS STRING), ' ', CAST(latitude AS STRING), ')') as geometry,
        ROW_NUMBER() OVER (ORDER BY event_timestamp DESC) as objectid
      FROM pubsec_geo_law.demo.device_locations_with_persons
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      LIMIT 10000
    `, { runAsync: true });
    console.log('✅ Created device_locations_sample_koop (Device Location Tracks - 10K sample)\n');

    // Verify the views
    console.log('Verifying created views...\n');

    const views = ['cases_silver_koop', 'cell_device_counts_koop', 'device_locations_sample_koop'];

    for (const view of views) {
      const countQuery = await session.executeStatement(
        `SELECT COUNT(*) as cnt FROM pubsec_geo_law.demo.${view}`,
        { runAsync: true }
      );
      const result = await countQuery.fetchAll();
      await countQuery.close();
      console.log(`  ${view}: ${result[0].cnt} records`);
    }

    await session.close();
    await conn.close();

    console.log('\n✅ All Koop views created successfully!');
    console.log('\nViews ready for Koop FeatureServer:');
    console.log('  1. pubsec_geo_law.demo.cases_silver_koop');
    console.log('  2. pubsec_geo_law.demo.cell_device_counts_koop');
    console.log('  3. pubsec_geo_law.demo.device_locations_sample_koop');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createKoopViews();
