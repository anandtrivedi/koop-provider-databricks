#!/usr/bin/env node

const https = require('https')
const http = require('http')

const BASE_URL = 'http://localhost:8080/databricks/rest/services/main.default.koop_large_test/FeatureServer/0/query'

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : http

    client.get(url, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        const endTime = Date.now()
        const duration = endTime - startTime

        try {
          const json = JSON.parse(data)
          resolve({ duration, data: json, size: data.length })
        } catch (error) {
          reject(new Error(`Parse error: ${error.message}`))
        }
      })
    }).on('error', (error) => {
      reject(error)
    })
  })
}

async function runTest(name, url, opts = {}) {
  const iterations = opts.iterations || 1
  const times = []

  console.log(`\n${name}`)
  console.log('  URL:', url.replace(BASE_URL, '...'))

  for (let i = 0; i < iterations; i++) {
    try {
      const result = await makeRequest(url)
      times.push(result.duration)

      if (iterations === 1) {
        console.log(`  ⏱️  Time: ${result.duration}ms`)
        console.log(`  📦 Size: ${(result.size / 1024).toFixed(2)} KB`)

        if (result.data.count !== undefined) {
          console.log(`  📊 Count: ${result.data.count}`)
        } else if (result.data.features) {
          console.log(`  📊 Features: ${result.data.features.length}`)
        } else if (result.data.objectIds) {
          console.log(`  📊 IDs: ${result.data.objectIds.length}`)
        }
      } else {
        process.stdout.write('.')
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`)
      return
    }
  }

  if (iterations > 1) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    console.log(`\n  ⏱️  Avg: ${avg.toFixed(0)}ms, Min: ${min}ms, Max: ${max}ms (${iterations} runs)`)
  }
}

async function runPerformanceTests() {
  console.log('='.repeat(70))
  console.log('KOOP DATABRICKS PROVIDER - PERFORMANCE TESTS')
  console.log('Dataset: 5,000 records across 25 US states')
  console.log('='.repeat(70))

  // Test 1: Count query (minimal data transfer)
  await runTest(
    '1. Count Query (Total Records)',
    `${BASE_URL}?returnCountOnly=true`
  )

  // Test 2: Count with filter
  await runTest(
    '2. Count Query (WITH WHERE filter)',
    `${BASE_URL}?returnCountOnly=true&where=population>100000`
  )

  // Test 3: Return IDs only
  await runTest(
    '3. Return IDs Only (All Records)',
    `${BASE_URL}?returnIdsOnly=true`
  )

  // Test 4: Paginated query (first page)
  await runTest(
    '4. Paginated Query (Page 1, 100 records)',
    `${BASE_URL}?resultRecordCount=100&resultOffset=0`
  )

  // Test 5: Paginated query (middle page)
  await runTest(
    '5. Paginated Query (Page 25, 100 records)',
    `${BASE_URL}?resultRecordCount=100&resultOffset=2500`
  )

  // Test 6: Large page
  await runTest(
    '6. Large Page (1000 records)',
    `${BASE_URL}?resultRecordCount=1000&resultOffset=0`
  )

  // Test 7: WHERE filter query
  await runTest(
    '7. WHERE Filter (population > 100,000)',
    `${BASE_URL}?where=population>100000&resultRecordCount=100`
  )

  // Test 8: Spatial query (California bbox)
  await runTest(
    '8. Spatial Query (California bbox)',
    `${BASE_URL}?geometry=-124.4,32.5,-114.1,42&resultRecordCount=100`
  )

  // Test 9: Combined filters
  await runTest(
    '9. Combined Filters (WHERE + Spatial)',
    `${BASE_URL}?where=population>50000&geometry=-125,30,-100,50&resultRecordCount=100`
  )

  // Test 10: ORDER BY query
  await runTest(
    '10. ORDER BY (Population DESC, 100 records)',
    `${BASE_URL}?orderByFields=population DESC&resultRecordCount=100`
  )

  // Test 11: Field selection (no geometry)
  await runTest(
    '11. Field Selection (returnGeometry=false)',
    `${BASE_URL}?returnGeometry=false&resultRecordCount=100`
  )

  // Test 12: Selected fields only
  await runTest(
    '12. Selected Fields (outFields=place_name,population)',
    `${BASE_URL}?outFields=place_name,population,state&resultRecordCount=100`
  )

  // Test 13: Stress test - multiple sequential pages
  console.log('\n13. Stress Test - Sequential Pagination (10 pages, 100 records each)')
  const pageStart = Date.now()
  for (let page = 0; page < 10; page++) {
    const offset = page * 100
    await makeRequest(`${BASE_URL}?resultRecordCount=100&resultOffset=${offset}`)
    process.stdout.write('.')
  }
  const pageEnd = Date.now()
  console.log(`\n  ⏱️  Total time for 10 pages: ${pageEnd - pageStart}ms`)
  console.log(`  📊 Average per page: ${((pageEnd - pageStart) / 10).toFixed(0)}ms`)

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('PERFORMANCE TEST COMPLETE')
  console.log('='.repeat(70))
  console.log('\n💡 Key Performance Indicators:')
  console.log('   - Count queries should be < 1000ms')
  console.log('   - Small pages (100 records) should be < 2000ms')
  console.log('   - Large pages (1000 records) should be < 5000ms')
  console.log('   - Spatial queries may take longer due to ST_Intersects processing')
  console.log('\n📝 Optimization Recommendations:')
  console.log('   - Add indexes to Databricks table on objectid and frequently filtered columns')
  console.log('   - Consider spatial indexing for geometry_wkt column')
  console.log('   - Use returnCountOnly and returnIdsOnly when full features not needed')
  console.log('   - Use pagination with reasonable page sizes (100-1000 records)')
  console.log('   - Use outFields to select only needed columns')
  console.log('   - Use returnGeometry=false when geometry not needed\n')
}

runPerformanceTests().catch(error => {
  console.error('\n❌ Test suite failed:', error.message)
  process.exit(1)
})
