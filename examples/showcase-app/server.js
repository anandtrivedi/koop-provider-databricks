/*
  server.js — Overture COP showcase app

  Bundles the Databricks Koop provider with a static ArcGIS Maps SDK (JS)
  frontend and a Query Inspector API. One process serves:
    /databricks/rest/services/...   ArcGIS FeatureServer endpoints (Koop)
    /api/layers                     layer registry for the UI
    /api/querylog                   recent SQL pushed down to Databricks
    /                               the map UI (public/)
*/

const path = require('path')
const express = require('express')
const Koop = require('@koopjs/koop-core')

const provider = require('../../src')
const Model = require('../../src/model')
const layers = require('./config/layers.json')

const koop = new Koop({ logLevel: process.env.LOG_LEVEL || 'info' })
koop.register(provider)

const app = koop.server

app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/layers', (req, res) => res.json(layers))

app.get('/api/querylog', (req, res) => {
  res.json({ queries: Model.recentQueries.slice().reverse() })
})

app.get('/health', (req, res) => res.json({ status: 'ok' }))

const port = process.env.DATABRICKS_APP_PORT || process.env.PORT || 8080
app.listen(port, '0.0.0.0', () => {
  console.log(`Overture COP showcase listening on :${port}`)
})
