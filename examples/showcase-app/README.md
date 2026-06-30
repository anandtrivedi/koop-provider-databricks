# Overture COP — Showcase App

A single-process demo that bundles this Koop provider with an ArcGIS Maps SDK (JS)
frontend: every map interaction becomes ArcGIS FeatureServer requests, which Koop
translates into Databricks SQL (`ST_Intersects` bbox pushdown, attribute WHERE
clauses, H3 filters, time filters) against Overture Maps tables — and the Query
Inspector panel shows each statement live.

## What it demonstrates

| Feature | Layer | Provider capability |
|---|---|---|
| Viewport spatial pushdown | Structures (NCR, 1.6M Overture footprints) | bbox envelope → `ST_Intersects` |
| Attribute filtering | Critical Infrastructure (225K places) | `where` → validated SQL WHERE |
| Scale-dependent aggregation | Activity Density (H3 res5/res8) | pre-aggregated H3 layers |
| Temporal queries | Contact Track History (AIS) | `time`/`timeField` → `BETWEEN TIMESTAMP` |
| Esri-native read/write side-by-side | Comms Infrastructure (editable) | CDF on ArcGIS Server + Lakebase |

## Running locally

From the repo root (uses the root `.env` for Databricks credentials):

```bash
npm install
node examples/showcase-app/server.js
# open http://localhost:8080
```

Tables are expected at `atrivedi.koop_demo.*` (see `config/layers.json`) with the
provider defaults: `objectid` id column, `geometry_wkt` WKT geometry, SRID 4326.

## Endpoints

- `/` — map UI
- `/databricks/rest/services/{catalog.schema.table}/FeatureServer/0/query` — Koop
- `/api/layers` — layer registry consumed by the UI
- `/api/querylog` — last 50 SQL statements (drives the Query Inspector)
- `/health` — liveness

## Running the demo

Open the app, wait for the "Querying Databricks — please wait" loader to clear, then click
**▶ Play Demo** (top-right). The guided tour auto-advances through narrated steps
(Pause / Back / Next / ↺ Replay), flying the camera across the configured tabs while
explaining how each layer is queried live from Databricks and served to ArcGIS via Koop.

**Talk track:**
1. **Live from the Lakehouse** — nothing is copied into ArcGIS; point at the **Query Inspector** — every pan/zoom pushes a spatial SQL query (`ST_*`) to Databricks.
2. **Per tab** — each ArcGIS FeatureLayer is backed by a Databricks table; Koop translates the map query to Databricks SQL on the fly (bbox pushdown, attribute WHERE, H3, time).
3. **Track History Replay** (maritime/track tabs) — scrub the time slider; each frame is a fresh time-filtered query to Databricks.
4. **Wrap** — Lakehouse → Koop → ArcGIS, all live, no extracts.

Watch the **Query Inspector** throughout — it shows the exact SQL each interaction pushes down.

## Databricks Apps deployment

`app.yaml` at the repo root deploys this app (the Apps runtime injects the
service principal credentials and port). The app's service principal needs
`USE CATALOG` / `USE SCHEMA` / `SELECT` on the demo schema and `CAN_USE` on the
SQL warehouse (declared as an app resource).

## Notes

- The editable CDF overlay points at an ArcGIS Server with a self-signed
  certificate — open the service URL once in your browser and trust the
  certificate, then reload the app.
- The AIS dataset covers 2026-02-16 → 2026-02-18; the replay slider steps hourly.
