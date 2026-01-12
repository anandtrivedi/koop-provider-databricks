#!/bin/bash

# Comprehensive Koop Provider Test Suite
# Tests all major FeatureServer API features

BASE_URL="http://localhost:8080/databricks/rest/services/main.default.koop_test_cities/FeatureServer/0/query"

echo "=========================================="
echo "KOOP DATABRICKS PROVIDER - COMPREHENSIVE TEST"
echo "=========================================="
echo ""

# Test 1: Basic query
echo "1. Basic Query (all features)"
curl -s "$BASE_URL?resultRecordCount=2" | jq '{count: (.features | length), first_city: .features[0].attributes.city_name}'
echo ""

# Test 2: WHERE filter
echo "2. WHERE Filter (state = 'California')"
curl -s "$BASE_URL?where=state='California'" | jq '{count: (.features | length), cities: [.features[].attributes.city_name]}'
echo ""

# Test 3: Geometry bbox filter
echo "3. Geometry Filter (West Coast bbox)"
curl -s "$BASE_URL?geometry=-125,30,-115,50" | jq '{count: (.features | length), cities: [.features[].attributes.city_name]}'
echo ""

# Test 4: outFields
echo "4. Field Selection (outFields=city_name,population)"
curl -s "$BASE_URL?outFields=city_name,population&resultRecordCount=2" | jq '.features[0].attributes'
echo ""

# Test 5: returnGeometry=false
echo "5. No Geometry (returnGeometry=false)"
curl -s "$BASE_URL?returnGeometry=false&resultRecordCount=1" | jq '.features[0]'
echo ""

# Test 6: Pagination - Page 1
echo "6. Pagination - Page 1 (offset=0, limit=3)"
curl -s "$BASE_URL?resultRecordCount=3&resultOffset=0" | jq '{count: (.features | length), objectIds: [.features[].attributes.objectid]}'
echo ""

# Test 7: Pagination - Page 2
echo "7. Pagination - Page 2 (offset=3, limit=3)"
curl -s "$BASE_URL?resultRecordCount=3&resultOffset=3" | jq '{count: (.features | length), objectIds: [.features[].attributes.objectid]}'
echo ""

# Test 8: Pagination - Page 3
echo "8. Pagination - Page 3 (offset=6, limit=3)"
curl -s "$BASE_URL?resultRecordCount=3&resultOffset=6" | jq '{count: (.features | length), objectIds: [.features[].attributes.objectid]}'
echo ""

# Test 9: ORDER BY
echo "9. ORDER BY (population DESC, limit 3)"
curl -s "$BASE_URL?orderByFields=population DESC&resultRecordCount=3" | jq '{cities: [.features[] | {name: .attributes.city_name, population: .attributes.population}]}'
echo ""

# Test 10: returnCountOnly
echo "10. Return Count Only (all records)"
curl -s "$BASE_URL?returnCountOnly=true" | jq '.'
echo ""

# Test 11: returnCountOnly with filter
echo "11. Return Count Only with WHERE filter"
curl -s "$BASE_URL?returnCountOnly=true&where=population>1000000" | jq '.'
echo ""

# Test 12: returnIdsOnly
echo "12. Return IDs Only (all records)"
curl -s "$BASE_URL?returnIdsOnly=true" | jq '{count: (.objectIds | length), first_5_ids: .objectIds[:5]}'
echo ""

# Test 13: returnIdsOnly with filter
echo "13. Return IDs Only with WHERE filter"
curl -s "$BASE_URL?returnIdsOnly=true&where=state='California'" | jq '.'
echo ""

# Test 14: returnIdsOnly with pagination
echo "14. Return IDs Only with pagination (page 1)"
curl -s "$BASE_URL?returnIdsOnly=true&resultRecordCount=3&resultOffset=0" | jq '.'
echo ""

# Test 15: Combined filters (WHERE + bbox + pagination + ORDER BY)
echo "15. Combined Filters (WHERE + bbox + pagination + ORDER BY)"
curl -s "$BASE_URL?where=population>500000&geometry=-125,25,-70,50&resultRecordCount=3&orderByFields=population DESC" | jq '{count: (.features | length), cities: [.features[] | {name: .attributes.city_name, population: .attributes.population, state: .attributes.state}]}'
echo ""

echo "=========================================="
echo "ALL TESTS COMPLETED"
echo "=========================================="
