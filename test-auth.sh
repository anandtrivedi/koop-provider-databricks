#!/bin/bash

# Test Authentication Implementation
# This script tests both disabled and enabled authentication modes

set -e

echo "================================================="
echo "Authentication Testing Script"
echo "================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:8080"

# Test table (modify if needed)
TEST_TABLE="samples.nyctaxi.trips"

echo -e "${YELLOW}📋 Prerequisites:${NC}"
echo "1. Koop server should be running on port 8080"
echo "2. For enabled mode tests, config/auth.json must exist"
echo ""

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="$3"

    echo -n "Testing $name... "
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$response_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $response_code)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Expected $expected_code, got $response_code)"
        return 1
    fi
}

# Function to check if server is running
check_server() {
    if ! curl -s "$BASE_URL/databricks/rest/info" > /dev/null 2>&1; then
        echo -e "${RED}✗ Server is not running on port 8080${NC}"
        echo "Please start the server with: npm start"
        exit 1
    fi
    echo -e "${GREEN}✓ Server is running${NC}"
}

echo "================================================="
echo "TEST 1: Server Health Check"
echo "================================================="
check_server
echo ""

echo "================================================="
echo "TEST 2: REST Info Endpoint"
echo "================================================="
INFO_RESPONSE=$(curl -s "$BASE_URL/databricks/rest/info")
echo "Response: $INFO_RESPONSE"

# Check if authInfo is present
if echo "$INFO_RESPONSE" | grep -q '"authInfo"'; then
    echo -e "${GREEN}✓ authInfo field present${NC}"

    # Check if token-based security is enabled
    if echo "$INFO_RESPONSE" | grep -q '"isTokenBasedSecurity":true'; then
        echo -e "${YELLOW}🔒 Token-based security is ENABLED${NC}"
        AUTH_MODE="enabled"
    else
        echo -e "${GREEN}🔓 Token-based security is DISABLED${NC}"
        AUTH_MODE="disabled"
    fi
else
    echo -e "${RED}✗ authInfo field missing${NC}"
fi
echo ""

echo "================================================="
echo "TEST 3: Disabled Mode Tests"
echo "================================================="
echo "Testing access without token..."

# Test FeatureServer metadata endpoint
test_endpoint "FeatureServer metadata" \
    "$BASE_URL/databricks/rest/services/$TEST_TABLE/FeatureServer/0?f=json" \
    "200" || true

echo ""

echo "================================================="
echo "TEST 4: Token Endpoint"
echo "================================================="
echo "Testing token endpoint availability..."

TOKEN_ENDPOINT="$BASE_URL/databricks/tokens/"
token_response_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"apiKey": "test-key"}' \
    "$TOKEN_ENDPOINT")

echo "Token endpoint response code: $token_response_code"

if [ "$token_response_code" = "401" ]; then
    echo -e "${YELLOW}Token endpoint requires valid API key (expected in enabled mode)${NC}"
elif [ "$token_response_code" = "400" ]; then
    echo -e "${GREEN}Token endpoint returns 400 (expected in disabled mode)${NC}"
elif [ "$token_response_code" = "200" ]; then
    echo -e "${GREEN}Token endpoint returns 200 (token generated)${NC}"
else
    echo -e "${YELLOW}Unexpected response code: $token_response_code${NC}"
fi

echo ""

echo "================================================="
echo "TEST SUMMARY"
echo "================================================="
echo "Authentication Mode Detected: $AUTH_MODE"
echo ""
echo "Next steps:"
if [ "$AUTH_MODE" = "disabled" ]; then
    echo "1. To test enabled mode:"
    echo "   - Generate API key: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    echo "   - Create config/auth.json (see config/auth.example.json)"
    echo "   - Set AUTH_MODE=enabled in .env"
    echo "   - Restart server: npm start"
    echo "   - Run this script again"
else
    echo "1. Authentication is enabled"
    echo "2. Obtain a token with your API key"
    echo "3. Use token in FeatureServer requests"
fi

echo ""
echo "================================================="
